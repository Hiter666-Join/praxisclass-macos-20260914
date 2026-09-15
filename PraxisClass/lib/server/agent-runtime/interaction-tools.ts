import { Type } from 'typebox';
import { Check } from 'typebox/value';
import type { AgentTool, SessionTreeEntry } from '@earendil-works/pi-agent-core';
import type { CheckpointInfo, CourseDocument, CourseToolDeps } from './course-tools';
import type { CourseBriefState } from './course-brief';
import { COURSE_STAGE_ID_DESCRIPTION } from './course-stage';
import {
  InteractionCaseSchema,
  runInteractionBrowser,
  type InteractionCase,
  type InteractionResult,
} from './interaction-browser';

export const TEST_INTERACTIVE_SCENE_TOOL_NAME = 'test_interactive_scene';
const AmendmentSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1, maxLength: 1000 }),
  sourceSeq: Type.Optional(Type.Integer({ minimum: 0 })),
  quote: Type.Optional(Type.String({ minLength: 1, maxLength: 4000 })),
  remove: Type.Optional(Type.Boolean()),
});
type Amendment = { name: string; reason: string; sourceSeq?: number; quote?: string; remove?: boolean };
export const INTERACTION_PARAMS = Type.Object({
  stageId: Type.String({ minLength: 1, description: COURSE_STAGE_ID_DESCRIPTION }),
  sceneId: Type.String({ minLength: 1 }),
  cases: Type.Optional(
    Type.Array(InteractionCaseSchema, {
      maxItems: 8,
      description:
        'Cases derived from original requirements. Each starts with a fresh page and needs an expect step. Omit to replay saved cases, or observe controls if no cases exist. Cases merge by name; omitted cases are retained.',
    }),
  ),
  amendments: Type.Optional(Type.Array(AmendmentSchema, { maxItems: 8, description: 'Explain every changed case. Selector-only corrections need a reason; semantic changes or removal require a newer explicit user instruction (sourceSeq and exact quote from read_course_brief).' })),
});

type Deps = Pick<CourseToolDeps, 'store' | 'stageAccess' | 'abortSignal'> & { courseBrief?: CourseBriefState };
export const INTERACTION_CHECKPOINT_TYPE = 'course-interaction-check';
export const COURSE_CHECKPOINT_TYPE = 'course-write-checkpoint';
type Receipt = {
  stageId: string;
  sceneId: string;
  html: string;
  cases: InteractionCase[];
  result?: InteractionResult;
  briefThroughSeq?: number;
  caseRequirements?: Record<string, { text: string; throughSeq: number }>;
  amendments?: Amendment[];
};
const keyOf = (stageId: string, sceneId: string) => JSON.stringify([stageId, sceneId]);
const scope =
  '实际 Chrome/Chromium 执行的自包含 HTML 用例；不等于教学内容全面审校、外部服务接通或真实代码编译。';

/** One run's acceptance cases, replayed automatically when the artifact changes. */
export class InteractionChecks {
  private receipts = new Map<string, Receipt>();
  private required = new Map<string, Set<string>>();

  constructor(
    private deps: Deps,
    private runBrowser = runInteractionBrowser,
    private persist?: (receipt: Receipt) => Promise<void>,
  ) {}

  /** Native custom entries survive compaction without entering the LLM prompt. */
  restore(entries: SessionTreeEntry[]): Set<string> {
    const stages = new Set<string>();
    for (const entry of entries) {
      if (entry.type !== 'custom' || !entry.data || typeof entry.data !== 'object') continue;
      if (entry.customType === COURSE_CHECKPOINT_TYPE) {
        const info = entry.data as CheckpointInfo;
        if (typeof info.stageId === 'string') {
          stages.add(info.stageId);
          this.markChanged(info);
        }
      } else if (entry.customType === INTERACTION_CHECKPOINT_TYPE) {
        const receipt = entry.data as Receipt;
        if (
          typeof receipt.stageId !== 'string' ||
          typeof receipt.sceneId !== 'string' ||
          typeof receipt.html !== 'string' ||
          !Check(Type.Array(InteractionCaseSchema, { maxItems: 8 }), receipt.cases)
        )
          continue;
        this.receipts.set(keyOf(receipt.stageId, receipt.sceneId), {
          ...receipt,
          // Execution conditions may have been fixed while the worker was stopped.
          result: receipt.result?.status === 'unavailable' ? undefined : receipt.result,
        });
        this.require(receipt.stageId, receipt.sceneId);
        stages.add(receipt.stageId);
      }
    }
    return stages;
  }

  markChanged(info: CheckpointInfo) {
    if (
      info.stageId &&
      info.sceneId &&
      ['generate_scene', 'patch_stage', 'duplicate_scene'].includes(info.tool)
    ) {
      this.require(info.stageId, info.sceneId);
    }
  }

  private require(stageId: string, sceneId: string) {
    const scenes = this.required.get(stageId) ?? new Set<string>();
    scenes.add(sceneId);
    this.required.set(stageId, scenes);
  }

  async execute(
    stageId: string,
    sceneId: string,
    additions?: InteractionCase[],
    signal = this.deps.abortSignal,
    amendments: Amendment[] = [],
  ) {
    signal?.throwIfAborted();
    if ((await this.deps.stageAccess(stageId)).kind !== 'owned')
      throw new Error('课程不存在或不属于当前会话用户。');
    const doc = await this.deps.store.loadDocument(stageId);
    const scene = doc?.scenes.find((item) => item.id === sceneId);
    if (scene?.content.type !== 'interactive' || !scene.content.html)
      throw new Error('此工具需要已保存的互动 HTML 页；不执行外部 URL、测验或 PBL 容器。');
    if (scene.content.html.length > 1_000_000)
      throw new Error('互动 HTML 超出本次检查的 1 MB 上限。');
    const key = keyOf(stageId, sceneId);
    const previous = this.receipts.get(key);
    const merged = new Map((previous?.cases ?? []).map((item) => [item.name, item]));
    const brief = this.deps.courseBrief;
    if (additions?.length || amendments.length) brief?.assertCurrent();
    const current = brief?.snapshot();
    const activeIds = new Set(current?.requirements.map(item => item.id));
    const caseRequirements = { ...previous?.caseRequirements };
    const authorizeChange = (name: string, amendment?: Amendment) => {
      if (!amendment?.reason.trim()) throw new Error('修改已有验收用例必须说明原因，并保留修改记录。');
      if (!brief || amendment.sourceSeq === undefined || !amendment.quote) {
        throw new Error('改变验收行为或删除用例需要新的用户要求依据，不能为了通过检查降低标准。');
      }
      brief.validateEvidence(amendment.sourceSeq, amendment.quote);
      if (amendment.sourceSeq <= (caseRequirements[name]?.throughSeq ?? previous?.briefThroughSeq ?? -1)) throw new Error('该用户要求已经用于原验收；请保留原目标，或引用之后的明确更新。');
    };
    for (const amendment of amendments.filter(item => item.remove)) {
      if (!merged.has(amendment.name)) throw new Error('待删除验收用例不存在。');
      authorizeChange(amendment.name, amendment);
      merged.delete(amendment.name);
      delete caseRequirements[amendment.name];
    }
    for (const item of additions ?? []) {
      if (
        !Check(InteractionCaseSchema, item) ||
        !item.steps.some((step) => step.action === 'expect')
      ) {
        throw new Error(
          '每个行为用例必须有合法操作和至少一个 expect 断言，点击成功不等于目标达成。',
        );
      }
      if (brief && (!item.requirementId || !activeIds.has(item.requirementId))) {
        throw new Error('新验收用例需要引用当前委托中的有效 requirementId。');
      }
      const existing = merged.get(item.name);
      let semanticsChanged = !existing;
      if (existing && JSON.stringify(existing) !== JSON.stringify(item)) {
        const amendment = amendments.find(change => change.name === item.name && !change.remove);
        if (!amendment?.reason.trim()) throw new Error('同名用例变更需要 amendments 说明，不能静默覆盖。');
        // A selector correction preserves the operation, inputs, ordering and expected outcomes.
        const behavior = (entry: InteractionCase) => JSON.stringify({
          requirement: entry.requirement, requirementId: entry.requirementId,
          steps: entry.steps.map(({ selector: _selector, ...step }) => step),
        });
        semanticsChanged = behavior(existing) !== behavior(item);
        if (semanticsChanged) authorizeChange(item.name, amendment);
      }
      const requirement = current?.requirements.find(requirement => requirement.id === item.requirementId);
      if (requirement && existing && !semanticsChanged && caseRequirements[item.name]?.text !== requirement.text) {
        authorizeChange(item.name, amendments.find(change => change.name === item.name && !change.remove));
        semanticsChanged = true;
      }
      if (requirement && (semanticsChanged || !caseRequirements[item.name])) {
        caseRequirements[item.name] = { text: requirement.text, throughSeq: current!.throughSeq };
      }
      merged.set(item.name, structuredClone(item));
    }
    const cases = [...merged.values()];
    if (cases.length > 8) throw new Error('每页最多保留 8 个核心行为用例。');
    this.require(stageId, sceneId);
    const cached =
      !!previous?.result &&
      previous.html === scene.content.html &&
      JSON.stringify(previous.cases) === JSON.stringify(cases);
    const pending: Receipt = { stageId, sceneId, html: scene.content.html, cases,
      caseRequirements,
      briefThroughSeq: additions?.length || amendments.length ? current?.throughSeq : previous?.briefThroughSeq,
      amendments: amendments.length ? structuredClone(amendments) : undefined };
    const receiptChanged = !cached || amendments.length > 0 || JSON.stringify(previous?.caseRequirements ?? {}) !== JSON.stringify(caseRequirements);
    // Save cases BEFORE execution, so interruption does not lose the acceptance target.
    if (receiptChanged) {
      await this.persist?.(pending);
      this.receipts.set(key, pending);
    }
    const result = cached
      ? previous!.result!
      : await this.runBrowser(scene.content.html, cases, signal);
    signal?.throwIfAborted();
    if (receiptChanged) await this.persist?.({ ...pending, result });
    this.receipts.set(key, { ...pending, result });
    return {
      stageId,
      sceneId,
      cached,
      scope,
      behaviorChecked: cases.length > 0,
      ...result,
      cases: result.cases.map((item) => ({
        ...item,
        snapshot: !item.passed || !cases.length ? item.snapshot : undefined,
      })),
      next:
        result.status === 'unavailable'
          ? '执行条件缺失，准确报告未验证，不要删减课程目标。'
          : result.status === 'failed'
            ? '读取失败页的相关源码，patch_stage 局部修正，再调用本工具（可省略 cases）重跑同一组用例。'
            : !cases.length
              ? '根据原始目标和控件编写行为用例；仅载入页面不能判定完成。'
              : '这些用例通过；继续完成其他目标。若 HTML 再次修改，完成前会自动重跑。',
    };
  }

  async inspect(doc: CourseDocument): Promise<{ issues: string[]; unavailable: string[]; checked: number }> {
    const issues: string[] = [];
    const unavailable: string[] = [];
    let checked = 0;
    for (const scene of doc.scenes) {
      if (
        scene.content.type !== 'interactive' ||
        !scene.content.html ||
        !this.required.get(doc.stage.id)?.has(scene.id)
      )
        continue;
      checked += 1;
      const previous = this.receipts.get(keyOf(doc.stage.id, scene.id));
      const activeRequirements = this.deps.courseBrief?.snapshot().requirements;
      if (activeRequirements && previous?.cases.some(item => {
        const requirement = activeRequirements.find(requirement => requirement.id === item.requirementId);
        return !requirement || previous.caseRequirements?.[item.name]?.text !== requirement.text;
      })) {
        issues.push(`第 ${scene.order} 页 (${scene.id}) 的验收依据已更新或尚未关联当前要求，请按当前委托核对用例并记录 amendments。`);
        continue;
      }
      if (!previous?.cases.length) {
        issues.push(
          `第 ${scene.order} 页 (${scene.id}) 尚无行为验收：调用 test_interactive_scene，按原始目标检查关键操作与预期结果；只有载入/截图不能算完成。`,
        );
        continue;
      }
      const report = await this.execute(doc.stage.id, scene.id);
      if (report.status === 'unavailable') {
        unavailable.push(`第 ${scene.order} 页 (${scene.id})：${report.message}`);
      } else if (report.status === 'failed') {
        issues.push(
          `第 ${scene.order} 页 (${scene.id}) 互动失败：${JSON.stringify({
            message: report.message,
            cases: report.cases
              .filter((item) => !item.passed)
              .map(({ name, requirement, checks, error, runtimeErrors }) => ({
                name,
                requirement,
                checks,
                error,
                runtimeErrors,
              })),
          })}`,
        );
      }
    }
    return { issues, unavailable, checked };
  }
}

export function buildInteractionTool(checks: InteractionChecks): AgentTool<never, never> {
  return {
    name: TEST_INTERACTIVE_SCENE_TOOL_NAME,
    label: 'Test interactive page in Chrome',
    description:
      'Execute persisted interactive HTML in Chrome/Chromium. Observe controls, or run click/fill/select/check/press and expect cases against original requirements. Returns concrete expected/actual values, runtime errors and failed-page snapshots. Does not submit student records. Cases replay after edits; text expectations use exact whitespace-normalized matching.',
    parameters: INTERACTION_PARAMS,
    // Keeps observations next to writes ordered, without claiming document write ownership.
    executionMode: 'sequential',
    async execute(_callId, params, signal) {
      try {
        if (!Check(INTERACTION_PARAMS, params)) throw new Error('互动检查参数无效。');
        const report = await checks.execute(params.stageId, params.sceneId, params.cases, signal, params.amendments);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(report) }],
          details: report,
          isError: report.status !== 'passed',
        };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: error instanceof Error ? error.message : String(error) },
          ],
          details: {},
          isError: true,
        };
      }
    },
  } as AgentTool<typeof INTERACTION_PARAMS> as unknown as AgentTool<never, never>;
}
