import { createHash } from 'node:crypto';
import { Type } from 'typebox';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { isActionType } from '@praxis/dsl';
import {
  buildCompleteScene,
  generateSceneActions,
  generateSceneContent,
  PBLGenerationError,
  type AICallFn,
  type ImageMapping,
  type PdfImage,
  type SceneGenerationContext,
} from '@praxis/generation';

import { putSceneBringingCurrent } from './document-writes';

import type { AppDocumentOutline } from '@/lib/document-store/persistence-types';
import type { SceneOutline } from '@/lib/types/generation';
import type { Action } from '@/lib/types/action';
import type { Scene } from '@/lib/types/stage';
import { COURSE_STAGE_ID_DESCRIPTION } from './course-stage';
import type { CourseToolDeps } from './course-tools';
import { runStageMutation } from './mutation-fence';
import { shiftCourseOrders } from './course-edit/tools';
import { createGenerationAiCallFactory, sceneContentStage } from './generation-ai-call';
import { synthesizeSceneNarration } from './scene-tts';
import { toGenerationContent } from './generation-content';
import { checkScenesAgainstSkill } from './skills';
import { isMediaPlaceholder } from '@/lib/store/media-generation';
import { buildVocationalGenerationContext, withVocationalGenerationContext } from '@/lib/server/vocational-generation-context';
import { mergeStageOutline } from './course-outline-union';
import { withGenerationRequirementCall } from '@/lib/server/generation-request-context';
import { GenerationQualityError, checkInteractiveScripts } from '@/lib/server/generation-content-quality';
import { checkGenerationPlan } from '@/lib/server/generation-plan-review';
import { inspectCourseQuality } from './course-quality';

const MAX_GENERATE_SCENE_MEDIA = 8;
const SUPPORTED_SCENE_TYPES = new Set(['slide', 'quiz', 'interactive', 'pbl']);

const QuizConfigSchema = Type.Object({
  questionCount: Type.Integer({ minimum: 1, description: 'Exact number of questions required for this page.' }),
  difficulty: Type.Union([Type.Literal('easy'), Type.Literal('medium'), Type.Literal('hard')]),
  questionTypes: Type.Array(Type.Union([Type.Literal('single'), Type.Literal('multiple'), Type.Literal('text')]), { minItems: 1 }),
});

const SceneParams = Type.Object({
  stageId: Type.String({ description: COURSE_STAGE_ID_DESCRIPTION }),
  order: Type.Integer({ minimum: 1 }),
  title: Type.String({ minLength: 1 }),
  type: Type.Union([
    Type.Literal('slide'),
    Type.Literal('quiz'),
    Type.Literal('interactive'),
    Type.Literal('pbl'),
  ]),
  widgetType: Type.Optional(
    Type.Union(
      [
        Type.Literal('simulation'),
        Type.Literal('diagram'),
        Type.Literal('code'),
        Type.Literal('game'),
        Type.Literal('visualization3d'),
        Type.Literal('procedural-skill'),
      ],
      {
        description:
          'Interactive pages only: which widget to build. simulation = parameter explorer, diagram = flowchart/mindmap/hierarchy/system graph, code = programming challenge, game = quiz/puzzle/strategy/card/action, visualization3d = 3D scene, procedural-skill = vocational operation stages with tools, ordered steps, success criteria and error consequences. Defaults to simulation when omitted.',
      },
    ),
  ),
  widgetOutline: Type.Optional(
    Type.Unknown({
      description:
        'Interactive pages only: widget configuration object matching widgetType (e.g. { concept, keyVariables } for simulation, { diagramType, nodes } for diagram, { language } for code, { gameType, challenge } for game, { visualizationType, objects } for visualization3d; { procedureType, task, tools, steps, successCriteria, errorConsequences } for procedural-skill). Vocational pages also retain task, steps and successCriteria alongside their specialized fields. Must be a plain object.',
    }),
  ),
  brief: Type.String({ minLength: 1 }),
  quizConfig: Type.Optional(QuizConfigSchema),
  requirement: Type.Optional(Type.String({ description: 'The original course request and current user requirements, verbatim. Pass this for every generated page so the content model retains goals beyond this page brief.' })),
  instruction: Type.Optional(Type.String()),
  materialFacts: Type.Optional(Type.Array(Type.String())),
  media: Type.Optional(
    Type.Array(
      Type.Object({
        src: Type.String({ minLength: 1 }),
        description: Type.String({ minLength: 1 }),
        width: Type.Optional(Type.Number({ minimum: 1 })),
        height: Type.Optional(Type.Number({ minimum: 1 })),
      }),
      { maxItems: 8 },
    ),
  ),
});
const ListParams = Type.Object({
  stageId: Type.String({ description: COURSE_STAGE_ID_DESCRIPTION }),
});
const ActionsParams = Type.Object({
  stageId: Type.String({ description: COURSE_STAGE_ID_DESCRIPTION }),
  sceneId: Type.Optional(Type.String()),
  order: Type.Optional(Type.Integer({ minimum: 1 })),
  styleDirective: Type.Optional(Type.String()),
  synthesizeAudio: Type.Optional(Type.Boolean()),
});
const DuplicateParams = Type.Object({
  stageId: Type.String({ description: COURSE_STAGE_ID_DESCRIPTION }),
  templateSceneId: Type.Optional(Type.String()),
  templateOrder: Type.Optional(Type.Integer({ minimum: 1 })),
  targetOrder: Type.Integer({ minimum: 1 }),
  title: Type.Optional(Type.String()),
});

type ActionGenerator = typeof generateSceneActions;

export interface GenerationToolDeps extends CourseToolDeps {
  aiCall?: AICallFn;
  generateActions?: ActionGenerator;
}

function sceneIdFor(scenes: readonly Scene[], order: number) {
  const preferred = `scene-p${order}`;
  const taken = new Set(scenes.map((scene) => scene.id));
  if (!taken.has(preferred)) return preferred;
  let suffix = 2;
  while (taken.has(`${preferred}-${suffix}`)) suffix += 1;
  return `${preferred}-${suffix}`;
}

function duplicateId(sessionId: string | undefined, callId: string) {
  const hash = createHash('sha256')
    .update(`${sessionId ?? ''}\0${callId}`)
    .digest('hex')
    .slice(0, 16);
  return `scene-dup-${hash}`;
}

function result(text: string, details: Record<string, unknown>, isError = false) {
  return { content: [{ type: 'text' as const, text }], details, ...(isError ? { isError } : {}) };
}

function outlineFromScene(scene: Scene, snapshot: unknown): SceneOutline {
  const planned = (snapshot as AppDocumentOutline | undefined)?.outlines?.find(
    (entry) => entry.id === scene.outlineId || entry.order === scene.order,
  );
  return {
    ...planned,
    id: scene.outlineId ?? scene.id,
    order: scene.order,
    title: scene.title,
    type: scene.type as SceneOutline['type'],
    description: planned?.description ?? scene.title,
    keyPoints: planned?.keyPoints ?? [],
  };
}

function concreteMediaSrc(src: string): boolean {
  if (src.startsWith('/') && !src.startsWith('//')) return src.length > 1 && !/\s/.test(src);
  if (!/^https?:\/\//i.test(src)) return false;
  try {
    const url = new URL(src);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export interface UnresolvedMediaPlaceholder {
  elementId: string;
  type: 'image' | 'video';
  placeholder: string;
}

/** Find slide media elements that would still render as skeletons. */
export function collectUnresolvedMediaPlaceholders(scene: Scene): UnresolvedMediaPlaceholder[] {
  if (scene.type !== 'slide') return [];
  const placeholders: UnresolvedMediaPlaceholder[] = [];
  for (const element of scene.content.canvas.elements) {
    const candidate = element as unknown as {
      id?: string;
      type?: string;
      src?: string;
      mediaRef?: string;
    };
    if (!candidate.id) continue;
    if (candidate.type === 'image' && candidate.src && isMediaPlaceholder(candidate.src)) {
      placeholders.push({
        elementId: candidate.id,
        type: 'image',
        placeholder: candidate.src,
      });
    }
    if (
      candidate.type === 'video' &&
      (!candidate.src ||
        isMediaPlaceholder(candidate.src) ||
        (candidate.mediaRef ? isMediaPlaceholder(candidate.mediaRef) : false))
    ) {
      placeholders.push({
        elementId: candidate.id,
        type: 'video',
        placeholder:
          (candidate.src && isMediaPlaceholder(candidate.src) ? candidate.src : undefined) ??
          (candidate.mediaRef && isMediaPlaceholder(candidate.mediaRef)
            ? candidate.mediaRef
            : undefined) ??
          candidate.mediaRef ??
          '',
      });
    }
  }
  return placeholders;
}

function actionContext(scenes: readonly Scene[], current: Scene): SceneGenerationContext {
  const ordered = [...scenes].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((scene) => scene.id === current.id);
  const previous = index > 0 ? ordered[index - 1] : undefined;
  return {
    pageIndex: Math.max(0, index) + 1,
    totalPages: ordered.length,
    allTitles: ordered.map((scene) => scene.title),
    previousSpeeches: (previous?.actions ?? [])
      .filter((action) => action.type === 'speech')
      .map((action) => action.text)
      .filter(Boolean)
      .slice(-3),
  };
}

/** Drop action names unknown to the current DSL before they reach persistence. */
export function filterKnownActions(actions: readonly Action[]): Action[] {
  return actions.filter((action) => isActionType(action.type));
}

export function buildGenerationTools(deps: GenerationToolDeps): AgentTool<never, never>[] {
  const routed = createGenerationAiCallFactory({ abortSignal: deps.abortSignal });
  const aiCallFor = (stage: Parameters<typeof routed>[0]) => deps.aiCall ?? routed(stage);
  const actionGenerator = deps.generateActions ?? generateSceneActions;
  const vocationalCall = (call: AICallFn, outline: SceneOutline, doc: { scenes: Scene[]; outline?: unknown }, requirement?: string): AICallFn => {
    const snapshot = doc.outline as AppDocumentOutline | undefined;
    const planned = snapshot?.outlines ?? [];
    const active = deps.getActiveSkill?.()?.name === 'vocational' || outline.widgetType === 'procedural-skill' || planned.some(page => page.widgetType === 'procedural-skill');
    const allOutlines: SceneOutline[] = mergeStageOutline({ scenes: doc.scenes, planned, generationComplete: snapshot?.generationComplete })
      .filter(page => page.order !== outline.order)
      .map(page => ({ ...page, id: page.outlineId ?? page.sceneId ?? `p${page.order}`, description: page.description ?? '', keyPoints: page.keyPoints ?? [] }));
    allOutlines.push(outline);
    allOutlines.sort((a, b) => a.order - b.order);
    const context = buildVocationalGenerationContext({ requirement: snapshot?.requirement ?? outline.title, taskEngineMode: active }, outline, allOutlines);
    const goalCall = withGenerationRequirementCall(call, { requirement: deps.getUserRequirement?.() || requirement || snapshot?.requirement || outline.description,
      sourceContext: snapshot?.sourceContext });
    return context ? (system, user, ...rest) => goalCall(system, withVocationalGenerationContext(user, context), ...rest) : goalCall;
  };

  const generateScene: AgentTool<typeof SceneParams> = {
    name: 'generate_scene',
    label: 'Generate page',
    description:
      'Generate and durably persist one page from an explicit title, type, and brief. Reusing an order replaces that page. Interactive pages accept widgetType (simulation/diagram/code/game/visualization3d/procedural-skill) plus a matching widgetOutline object; both are rejected for other page types.',
    parameters: SceneParams,
    async execute(_callId, params, signal) {
      if (!Number.isInteger(params.order) || params.order < 1) {
        return result(
          'generate_scene needs a 1-based integer page order.',
          {
            error: 'invalid-order',
          },
          true,
        );
      }
      const doc = await deps.store.loadDocument(params.stageId);
      if (!doc) return result('No course document yet. Call create_stage first.', {}, true);
      const existing = doc.scenes.find((scene) => scene.order === params.order);
      const title = params.title.trim();
      const brief = params.brief.trim();
      if (!title || !brief) {
        return result(
          'generate_scene needs a non-empty title and brief.',
          {
            error: 'missing-title-or-brief',
          },
          true,
        );
      }
      if (existing && !SUPPORTED_SCENE_TYPES.has(existing.type)) {
        return result(
          `Page ${params.order} has unsupported type "${existing.type}" and was left unchanged.`,
          { blocked: 'unsupported-type', sceneId: existing.id, type: existing.type },
          true,
        );
      }
      if (existing?.type === 'pbl' && params.type !== 'pbl') {
        return result(
          'The existing page is a PBL project. Delete it first or regenerate it as pbl; changing its type here would destroy the project.',
          { blocked: 'pbl-type-change', sceneId: existing.id, type: existing.type },
          true,
        );
      }
      if (params.instruction && params.type === 'pbl') {
        return result(
          'generate_scene cannot apply an instruction to a PBL page because the planner would drop it. Use patch_stage for a fine edit or regenerate without instruction.',
          { blocked: 'pbl-instruction-not-supported', sceneId: existing?.id },
          true,
        );
      }
      if (
        params.type !== 'interactive' &&
        (params.widgetType !== undefined || params.widgetOutline !== undefined)
      ) {
        return result(
          'generate_scene only accepts widgetType/widgetOutline for interactive pages.',
          { error: 'widget-requires-interactive', type: params.type },
          true,
        );
      }
      if (
        params.widgetOutline !== undefined &&
        (typeof params.widgetOutline !== 'object' ||
          params.widgetOutline === null ||
          Array.isArray(params.widgetOutline))
      ) {
        return result(
          'generate_scene needs widgetOutline to be an object matching widgetType.',
          { error: 'invalid-widget-outline' },
          true,
        );
      }
      const requestedMedia = params.media ?? [];
      if (requestedMedia.length > MAX_GENERATE_SCENE_MEDIA) {
        return result(
          `generate_scene accepts at most ${MAX_GENERATE_SCENE_MEDIA} media items.`,
          { error: 'too-many-media', maxItems: MAX_GENERATE_SCENE_MEDIA },
          true,
        );
      }
      const savedPage = (doc.outline as AppDocumentOutline | undefined)?.outlines?.find(
        page => existing?.outlineId ? page.id === existing.outlineId : page.order === params.order,
      );
      const plannedPage = savedPage?.type === params.type ? savedPage : undefined;
      const outline: SceneOutline = {
        ...plannedPage,
        id: existing?.outlineId ?? plannedPage?.id ?? `p${params.order}`,
        order: params.order,
        title,
        type: params.type,
        description: plannedPage?.description && plannedPage.description !== brief
          ? `${plannedPage.description}\n\nCurrent page instruction: ${brief}` : brief,
        keyPoints: [...new Set([...(plannedPage?.keyPoints ?? []), ...(params.materialFacts ?? [])])],
        ...(params.type === 'quiz' && params.quizConfig ? { quizConfig: params.quizConfig } : {}),
        ...(params.type === 'interactive' &&
        (params.widgetType !== undefined || params.widgetOutline !== undefined || plannedPage?.widgetType !== undefined)
          ? {
              widgetType: params.widgetType ?? plannedPage?.widgetType ?? 'simulation',
              // Mirror the generator fallback so a bare widgetType still generates.
              widgetOutline: { concept: title, ...plannedPage?.widgetOutline,
                ...(params.widgetOutline as SceneOutline['widgetOutline'] | undefined) },
            }
          : {}),
        ...(params.type === 'pbl'
          ? {
              pblConfig: {
                ...plannedPage?.pblConfig,
                projectTopic: plannedPage?.pblConfig?.projectTopic ?? params.title.trim(),
                projectDescription: plannedPage?.pblConfig?.projectDescription ?? params.brief.trim(),
                targetSkills: plannedPage?.pblConfig?.targetSkills ?? params.materialFacts ?? [],
              },
            }
          : {}),
      };
      const baseline =
        params.instruction && existing?.type === 'slide'
          ? {
              elements: existing.content.canvas.elements,
              background: existing.content.canvas.background,
            }
          : undefined;
      const assignedImages: PdfImage[] = [];
      const imageMapping: ImageMapping = {};
      for (const [index, media] of (params.media ?? []).entries()) {
        const src = media.src.trim();
        const description = media.description.trim();
        if (!description) {
          return result(
            'Every media item needs a non-empty description.',
            {
              error: 'invalid-media-description',
              index,
            },
            true,
          );
        }
        if (isMediaPlaceholder(src) || !concreteMediaSrc(src)) {
          return result(
            'Every media item needs a concrete HTTP(S) URL or same-origin path, not a placeholder or data URL.',
            {
              error: isMediaPlaceholder(src) ? 'media-placeholder-src' : 'invalid-media-src',
              index,
            },
            true,
          );
        }
        const id = `img_${index + 1}`;
        assignedImages.push({
          id,
          src,
          description,
          pageNumber: index + 1,
          sourceDocumentName: 'page media input',
          ...(media.width ? { width: media.width } : {}),
          ...(media.height ? { height: media.height } : {}),
        });
        imageMapping[id] = src;
      }
      const agents = doc.stage.generatedAgentConfigs;
      const pageCall = vocationalCall(aiCallFor(sceneContentStage(params.type)), outline, doc, params.requirement);
      let content: Awaited<ReturnType<typeof generateSceneContent>>;
      try {
        content = await generateSceneContent(outline, pageCall, {
          agents,
          languageDirective: doc.stage.languageDirective ?? '',
          allowProceduralSkill: true,
          ...(assignedImages.length ? { assignedImages, imageMapping } : {}),
          ...(params.instruction ? { editDirective: params.instruction } : {}),
          ...(baseline ? { baselineContent: baseline } : {}),
        });
      } catch (error) {
        if (error instanceof GenerationQualityError) {
          return result(error.message, { error: 'generation-quality', issues: error.issues, order: params.order }, true);
        }
        if (error instanceof PBLGenerationError) {
          return result(
            `PBL generation failed and nothing was written. ${error.message}`,
            {
              error: 'pbl-planner-failed',
              order: params.order,
              title,
              sceneId: existing?.id,
              ...(error.statusCode !== undefined ? { statusCode: error.statusCode } : {}),
              cause: error.message,
            },
            true,
          );
        }
        throw error;
      }
      if (signal?.aborted) throw new Error('aborted');
      if (!content) return result('Page content generation failed; nothing was written.', {}, true);
      const scriptIssues = content && 'html' in content ? checkInteractiveScripts(content.html) : [];
      // Persist the draft so THIS agent can read and patch it. A broken page
      // does not spend another generation call on narration or hidden repair.
      const actions = scriptIssues.length ? [] : filterKnownActions(
        await actionGenerator(outline, content, vocationalCall(aiCallFor('scene-actions'), outline, doc, params.requirement), {
          agents,
          languageDirective: doc.stage.languageDirective ?? '',
        }),
      );
      const built = buildCompleteScene(outline, content, actions, params.stageId, {
        sceneId: existing?.id ?? sceneIdFor(doc.scenes, params.order),
      });
      if (!built) return result('Page assembly failed; nothing was written.', {}, true);
      const scene = built as Scene;
      await runStageMutation(signal, () =>
        putSceneBringingCurrent(deps.store, params.stageId, scene),
      );
      const skill = deps.getActiveSkill?.() ?? null;
      const afterWrite = await deps.store.loadDocument(params.stageId);
      const skillViolations =
        skill && afterWrite ? checkScenesAgainstSkill(afterWrite.scenes, skill.constraints) : [];
      const persisted = afterWrite?.scenes.find((item) => item.id === scene.id) ?? scene;
      const mediaPlaceholders = collectUnresolvedMediaPlaceholders(persisted);
      deps.onCheckpoint({
        tool: 'generate_scene',
        stageId: params.stageId,
        sceneId: scene.id,
        order: scene.order,
        title: scene.title,
        sceneType: scene.type,
        skill: skill?.id,
        ...(skillViolations.length ? { skillViolations } : {}),
        detail: `page ${scene.order} persisted`,
      });
      if (scriptIssues.length) {
        return result(JSON.stringify({ stageId: params.stageId, sceneId: scene.id,
          issues: scriptIssues, draftSaved: true,
          next: 'read_stage 本页源码，用 patch_stage str_replace 修正错误，然后 list_scenes 复查。通过后 generate_actions。不要重新生成整页。' }),
          { sceneId: scene.id, issues: scriptIssues }, true);
      }
      return result(
        `Page ${scene.order} "${scene.title}" persisted.${
          skillViolations.length
            ? ` SKILL CONSTRAINT CHECK against "${skill?.id}": ${skillViolations.join('; ')}.`
            : ''
        }${
          mediaPlaceholders.length
            ? ` ${mediaPlaceholders.length} media placeholder(s) still render as skeletons.`
            : ''
        }`,
        {
          sceneId: scene.id,
          order: scene.order,
          type: scene.type,
          actionCount: actions.length,
          skill: skill?.id,
          ...(skillViolations.length ? { skillViolations } : {}),
          ...(mediaPlaceholders.length ? { mediaPlaceholders } : {}),
        },
      );
    },
  };

  const listScenes: AgentTool<typeof ListParams> = {
    name: 'list_scenes',
    label: 'List pages',
    description: 'List the pages currently persisted in a stage.',
    parameters: ListParams,
    async execute(_callId, params) {
      const doc = await deps.store.loadDocument(params.stageId);
      if (!doc) return result('Course not found.', {}, true);
      const report = inspectCourseQuality(doc, deps.getActiveSkill?.()?.constraints ?? null);
      return result(JSON.stringify(report), report, !report.passed);
    },
  };

  const generateActionsTool: AgentTool<typeof ActionsParams> = {
    name: 'generate_actions',
    label: 'Generate page actions',
    description:
      'Regenerate playback actions for one persisted page, optionally backfilling narration audio.',
    parameters: ActionsParams,
    async execute(_callId, params, signal) {
      const doc = await deps.store.loadDocument(params.stageId);
      const scene = params.sceneId
        ? doc?.scenes.find((item) => item.id === params.sceneId)
        : doc?.scenes.find((item) => item.order === params.order);
      if (!doc || !scene) return result('Page not found. Call list_scenes.', {}, true);
      const outline = outlineFromScene(scene, doc.outline);
      const actions = filterKnownActions(
        await actionGenerator(
          outline,
          toGenerationContent(scene.content),
          vocationalCall(aiCallFor('scene-actions'), outline, doc),
          {
            ctx: actionContext(doc.scenes, scene),
            agents: doc.stage.generatedAgentConfigs,
            languageDirective: doc.stage.languageDirective ?? '',
            userProfile: params.styleDirective,
          },
        ),
      );
      if (!actions.length)
        return result('No known actions were generated; the page was unchanged.', {}, true);
      const next = { ...scene, actions } as Scene;
      await runStageMutation(signal, () =>
        putSceneBringingCurrent(deps.store, params.stageId, next),
      );
      deps.onCheckpoint({
        tool: 'generate_actions',
        stageId: params.stageId,
        sceneId: scene.id,
        order: scene.order,
        detail: `${actions.length} actions persisted`,
      });
      let audio;
      if (params.synthesizeAudio !== false) {
        audio = await (deps.synthesizeTts ?? synthesizeSceneNarration)({
          scene: next,
          force: false,
          roster: doc.stage.generatedAgentConfigs,
          signal,
        });
        if (audio.changed) {
          await runStageMutation(signal, () =>
            putSceneBringingCurrent(deps.store, params.stageId, next),
          );
          deps.onCheckpoint({
            tool: 'generate_actions',
            stageId: params.stageId,
            sceneId: scene.id,
            order: scene.order,
            detail: 'narration audio persisted',
          });
        }
      }
      return result(`Persisted ${actions.length} known actions for "${scene.title}".`, {
        sceneId: scene.id,
        actions,
        ...(audio ? { audio } : {}),
      });
    },
  };

  const duplicateScene: AgentTool<typeof DuplicateParams> = {
    name: 'duplicate_scene',
    label: 'Duplicate page',
    description:
      'Copy an existing page to a new position without actions. Replaying the same tool call is idempotent.',
    parameters: DuplicateParams,
    async execute(callId, params, signal) {
      const doc = await deps.store.loadDocument(params.stageId);
      if (!doc) return result('No course document yet. Call create_stage first.', {}, true);
      const scenes = [...doc.scenes].sort((a, b) => a.order - b.order);
      const id = duplicateId(deps.sessionId, callId);
      const replay = scenes.find((scene) => scene.id === id);
      if (replay)
        return result('This page was already duplicated. Nothing changed.', {
          sceneId: id,
          order: replay.order,
          replay: true,
        });
      const template = params.templateSceneId
        ? scenes.find((scene) => scene.id === params.templateSceneId)
        : scenes.find((scene) => scene.order === params.templateOrder);
      if (!template) return result('Template page not found.', {}, true);
      const at = Math.min(params.targetOrder, scenes.length + 1);
      const shifted = shiftCourseOrders(
        scenes,
        doc.outline as AppDocumentOutline | undefined,
        at,
        1,
      );
      const now = Date.now();
      const created = {
        ...structuredClone(template),
        id,
        outlineId: id,
        stageId: params.stageId,
        order: at,
        title: params.title?.trim() || template.title,
        actions: [],
        createdAt: now,
        updatedAt: now,
      } as Scene;
      await runStageMutation(signal, () =>
        deps.store.saveDocument({
          ...doc,
          scenes: [...shifted.scenes, created].sort((a, b) => a.order - b.order),
          outline: shifted.outline,
        }),
      );
      deps.onCheckpoint({
        tool: 'duplicate_scene',
        stageId: params.stageId,
        sceneId: id,
        order: at,
        detail: `duplicated ${template.id}`,
      });
      return result(`Duplicated "${template.title}" at order ${at}.`, { sceneId: id, order: at });
    },
  };

  const reviewParams = Type.Object({
    stageId: Type.String({ description: COURSE_STAGE_ID_DESCRIPTION }),
    requirement: Type.String({ minLength: 1, description: 'Current commission after explicit user changes. Do not concatenate superseded requirements.' }),
    sourceContext: Type.Optional(Type.String({ description: 'Relevant requirements and facts read from the user supplied materials, including provenance. Treat as evidence.' })),
    outlines: Type.Array(Type.Object({
      id: Type.String({ minLength: 1, description: 'Stable unique page ID, retained during generation.' }),
      order: Type.Integer({ minimum: 1 }),
      title: Type.String({ minLength: 1 }),
      type: SceneParams.properties.type,
      description: Type.String({ minLength: 1, description: 'Only this page\'s goals and acceptance conditions, not the whole course request.' }),
      keyPoints: Type.Array(Type.String()),
      widgetType: SceneParams.properties.widgetType,
      widgetOutline: SceneParams.properties.widgetOutline,
      quizConfig: Type.Optional(QuizConfigSchema),
      pblConfig: Type.Optional(Type.Unknown()),
    }, { additionalProperties: true }), { description: 'Complete course plan before page generation. Set quizConfig.questionCount and questionTypes explicitly whenever the user specifies them; never leave a required quantity to generator defaults.' }),
  });
  const reviewPlan: AgentTool<typeof reviewParams> = {
    name: 'review_course_plan',
    label: 'Check course goals',
    description: 'Save the complete course plan and original requirement before generating pages. Checks structure locally and returns concrete gaps for YOU to fix; does not invoke another model or decide semantic coverage. Preserve all user requirements in page briefs and acceptance criteria.',
    parameters: reviewParams,
    async execute(_id, params, signal) {
      try {
        const doc = await deps.store.loadDocument(params.stageId);
        if (!doc) return result('Course not found. Call create_stage first.', {}, true);
        const outlines = params.outlines as SceneOutline[];
        const requirement = deps.getUserRequirement?.() || params.requirement;
        const issues = checkGenerationPlan(outlines, {
          requirement,
          taskEngineMode: deps.getActiveSkill?.()?.name === 'vocational',
        });
        if (issues.length) return result(JSON.stringify({ issues, next: '修正上述大纲缺项后再调用本工具。' }), { issues }, true);
        await runStageMutation(signal, () => deps.store.saveDocument({ ...doc, outline: {
          ...(doc.outline as AppDocumentOutline), outlines, requirement,
          currentBrief: deps.getCourseBrief?.(), validation: undefined,
          sourceContext: params.sourceContext ?? (doc.outline as AppDocumentOutline | undefined)?.sourceContext,
          generationComplete: false, producer: 'server-job', producerRef: deps.sessionId,
          updatedAt: Date.now(),
        } }));
        deps.onCheckpoint({ tool: 'review_course_plan', stageId: params.stageId, detail: 'course plan saved' });
        const report = { saved: true, requirement, outlines, sourceContext: params.sourceContext,
          next: '按原始要求核对每页目标后 generate_scene。结束前 list_scenes 并 read_stage 核对实际内容；保存大纲不等于教学目标已满足。' };
        return result(JSON.stringify(report), report);
      } catch (error) {
        if (error instanceof GenerationQualityError) return result(error.message, { issues: error.issues }, true);
        throw error;
      }
    },
  };

  return [reviewPlan, generateScene, listScenes, generateActionsTool, duplicateScene] as unknown as AgentTool<
    never,
    never
  >[];
}

export const GENERATION_TOOL_NAMES = [
  'review_course_plan',
  'generate_scene',
  'list_scenes',
  'generate_actions',
  'duplicate_scene',
] as const;
