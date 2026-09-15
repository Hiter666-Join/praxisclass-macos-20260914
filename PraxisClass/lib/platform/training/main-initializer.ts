import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { MAIN_SOURCE_FILES, mainTeachingPlan } from '@/lib/training/main-case';
import { getOwnerScopedDocumentStore } from '@/lib/server/agent-runtime/owner-scoped-documents';
import { getServerPersistenceProvider } from '@/lib/persistence/server-provider';
import { markStageGenerationComplete } from '@/lib/persistence/stage-meta';
import { trainingId, type TeachingPlan } from './contracts';
import { TrainingError } from './errors';
import type { TrainingActor, TrainingService } from './service';

const resourceRoot = () => join(process.cwd(), 'resources', 'training', 'main-ticket');
export const mainInitializationSchema = z
  .object({
    requestId: trainingId,
    materials: z
      .array(z.object({ sourceId: trainingId, materialRef: z.string().min(1).max(500) }).strict())
      .length(MAIN_SOURCE_FILES.length),
  })
  .strict();

export async function mainCaseMaterials(actor: TrainingActor) {
  if (actor.role !== 'teacher')
    throw new TrainingError(403, 'TEACHER_REQUIRED', '请在教师侧准备本次演示。');
  return {
    version: 'MAIN-TICKET-1.0',
    files: await Promise.all(
      MAIN_SOURCE_FILES.map(async (source) => ({
        ...source,
        text: await readFile(join(resourceRoot(), source.filename), 'utf8'),
      })),
    ),
  };
}

export async function initializeMainCase(
  service: TrainingService,
  actor: TrainingActor,
  input: z.infer<typeof mainInitializationSchema>,
) {
  const catalog = await mainCaseMaterials(actor);
  if (new Set(input.materials.map((material) => material.sourceId)).size !== catalog.files.length)
    throw new TrainingError(422, 'MATERIALS_REQUIRED', '请完成本次主案例所需文件的上传。');
  const sources: TeachingPlan['sources'] = [];
  for (const file of catalog.files) {
    const selected = input.materials.find((material) => material.sourceId === file.sourceId);
    if (!selected)
      throw new TrainingError(422, 'MATERIALS_REQUIRED', `尚未选择 ${file.filename}。`);
    const source: TeachingPlan['sources'][number] = {
      sourceId: file.sourceId,
      title: file.filename,
      kind: 'upload',
      materialRef: selected.materialRef,
      locator: file.filename,
      excerpt: file.text,
      basisType: file.basisType,
      studentVisible: true,
    };
    if (
      !service.deps.readSourceText ||
      (await service.deps.readSourceText(source, actor.ownerId)) !== file.text
    )
      throw new TrainingError(
        422,
        'MATERIAL_VERSION_MISMATCH',
        '上传资料与本次 MAIN-TICKET-1.0 版本不对应，请重新选择正式正文。',
      );
    sources.push(source);
  }
  const task = service.createTask(actor, {
    requestId: `main:${input.requestId}`,
    content: mainTeachingPlan('pending-a', 'pending-b', sources),
  });
  const stageA = `main-${task.id}-a`,
    stageB = `main-${task.id}-b`;
  if (task.activeRevision) return { taskId: task.id, stageIds: [stageA, stageB], reused: true };
  const store = await getOwnerScopedDocumentStore(actor.ownerId);
  const { pool } = await getServerPersistenceProvider(process.env.DATABASE_URL!);
  for (const lesson of [
    {
      stageId: stageA,
      title: '从一次请求到一个可信回答 · A 请求与响应',
      file: 'http-activity.html',
    },
    {
      stageId: stageB,
      title: '从一次请求到一个可信回答 · B 资料与依据',
      file: 'evidence-activity.html',
    },
  ]) {
    if (!(await store.loadDocument(lesson.stageId))) {
      const now = Date.now();
      const html = await readFile(join(resourceRoot(), lesson.file), 'utf8');
      await store.saveDocument({
        stage: {
          id: lesson.stageId,
          name: lesson.title,
          description:
            'MAIN-TICKET-1.0 教学合成案例；AI 辅助制作的预制图解与互动，当前验证成果独立保存。',
          createdAt: now,
          updatedAt: now,
          interactiveMode: true,
        },
        scenes: [
          {
            id: `${lesson.stageId}-activity`,
            stageId: lesson.stageId,
            title: lesson.title,
            order: 0,
            type: 'interactive',
            content: { type: 'interactive', html, widgetType: 'diagram' },
          },
        ],
        outline: {
          outlines: [],
          generationComplete: true,
          producer: 'server-job',
          requirement: '复用 MAIN-TICKET-1.0 已核对资料与教学互动',
          createdAt: now,
          updatedAt: now,
        },
      });
      await markStageGenerationComplete(pool, lesson.stageId);
    }
  }
  const saved = service.saveDraft(task.id, actor, {
    requestId: `prepare:${input.requestId}`,
    expectedDraftSeq: 0,
    baseRevision: 0,
    content: mainTeachingPlan(stageA, stageB, sources),
  });
  await service.applyTask(task.id, actor, {
    requestId: `apply:${input.requestId}`,
    expectedDraftSeq: saved.draftSeq,
    expectedActiveRevision: 0,
  });
  return { taskId: task.id, stageIds: [stageA, stageB], reused: false };
}
