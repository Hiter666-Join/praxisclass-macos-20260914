import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { EXTRA_CASES, extraTeachingPlan, type ExtraCaseId } from '@/lib/training/case-catalog';
import { getOwnerScopedDocumentStore } from '@/lib/server/agent-runtime/owner-scoped-documents';
import { getServerPersistenceProvider } from '@/lib/persistence/server-provider';
import { markStageGenerationComplete } from '@/lib/persistence/stage-meta';
import { trainingId, type TeachingPlan } from './contracts';
import { TrainingError } from './errors';
import type { TrainingActor, TrainingService } from './service';

export const extraCaseIdSchema = z.enum(['ai-code', 'retry', 'vision', 'warehouse']);
export const extraInitializationSchema = z.object({ requestId: trainingId, materials: z.array(z.object({ sourceId: trainingId, materialRef: z.string().min(1).max(500) }).strict()).max(20) }).strict();
export async function extraCaseMaterials(caseId: ExtraCaseId, actor: TrainingActor) {
  if (actor.role !== 'teacher') throw new TrainingError(403, 'TEACHER_REQUIRED', '请在教师侧准备本次案例。');
  const info = EXTRA_CASES[caseId];
  return { version: info.version, files: await Promise.all(info.files.map(async ([sourceId, filename, basisType]) => ({ sourceId, filename, basisType, text: await readFile(join(process.cwd(), 'resources/training', caseId, filename), 'utf8') }))) };
}

export async function buildExtraCaseHtml(caseId: ExtraCaseId) {
  let html = await readFile(join(process.cwd(), 'resources/training', caseId, 'activity.html'), 'utf8');
  if (caseId === 'ai-code') {
    // Copy the frozen block opaquely; never inspect, rewrite, log, or send hidden inputs to Agent.
    const original = await readFile(join(process.cwd(), 'examples/case-a/binary-search.html'), 'utf8');
    const frozen = original.match(/<script\b[^>]*\bid=["']frozen-cases["'][^>]*>[\s\S]*?<\/script>/)?.[0];
    if (!frozen) throw new TrainingError(503, 'FIXED_SUITE_UNAVAILABLE', '原固定验收套件尚未就绪。');
    html = html.replace('<!-- FROZEN_SUITE -->', frozen);
  } else {
    const base = join(process.cwd(), 'resources/training');
    html = html.replace('/* SIMULATION_ENGINE */', await readFile(join(base, 'simulation-engine.js'), 'utf8'))
      .replace('/* COMMON_JS */', await readFile(join(base, 'simulation-common.js'), 'utf8'))
      .replace('/* COMMON_CSS */', await readFile(join(base, 'simulation-common.css'), 'utf8'));
    if (caseId === 'vision') {
      for (let n = 1; n <= 8; n++) {
        const id = `Q${String(n).padStart(2, '0')}`;
        const svg = await readFile(join(base, 'vision/cards', `${id}-垫片示意.svg`), 'utf8');
        // Preserve original vector assets. Only convert their score labels to the agreed integer display.
        html = html.replace(`<!-- ${id} -->`, svg.replace(/(手工分数|>)0\.(\d{2})(?=["<])/g, (_, prefix, digits) => prefix + Number(digits)));
      }
    }
    if (caseId === 'warehouse') {
      html = html.replace('<!-- MAP -->', await readFile(join(base, 'warehouse/map.svg'), 'utf8'))
        .replace('<!-- TRANSIT -->', await readFile(join(base, 'warehouse/transit.svg'), 'utf8'));
    }
  }
  return html;
}

export async function initializeExtraCase(service: TrainingService, actor: TrainingActor, caseId: ExtraCaseId, input: z.infer<typeof extraInitializationSchema>) {
  const catalog = await extraCaseMaterials(caseId, actor);
  if (input.materials.length !== catalog.files.length || new Set(input.materials.map((f) => f.sourceId)).size !== catalog.files.length) throw new TrainingError(422, 'MATERIALS_REQUIRED', '请完成本案例正式正文的上传。');
  const sources: TeachingPlan['sources'] = [];
  for (const file of catalog.files) {
    const selected = input.materials.find((f) => f.sourceId === file.sourceId);
    if (!selected) throw new TrainingError(422, 'MATERIALS_REQUIRED', `尚未选择 ${file.filename}。`);
    const source: TeachingPlan['sources'][number] = { sourceId: file.sourceId, title: file.filename, kind: 'upload', materialRef: selected.materialRef, locator: file.filename, excerpt: file.text, basisType: file.basisType, studentVisible: true };
    if (!service.deps.readSourceText || await service.deps.readSourceText(source, actor.ownerId) !== file.text) throw new TrainingError(422, 'MATERIAL_VERSION_MISMATCH', '上传资料与当前正式版本不对应。');
    sources.push(source);
  }
  const task = service.createTask(actor, { requestId: `${caseId}:${input.requestId}`, content: extraTeachingPlan(caseId, 'pending', sources) });
  const stageId = `${caseId}-${task.id}`;
  if (task.activeRevision) return { taskId: task.id, stageIds: [stageId], reused: true };
  const store = await getOwnerScopedDocumentStore(actor.ownerId);
  const { pool } = await getServerPersistenceProvider(process.env.DATABASE_URL!);
  if (!await store.loadDocument(stageId)) {
    const now = Date.now(), info = EXTRA_CASES[caseId];
    await store.saveDocument({
      stage: { id: stageId, name: info.title, description: `${info.version} 教学案例；当前操作、运行与成果独立保存。`, createdAt: now, updatedAt: now, interactiveMode: true },
      scenes: [{ id: `${stageId}-activity`, stageId, title: info.title, order: 0, type: 'interactive', content: { type: 'interactive', html: await buildExtraCaseHtml(caseId), widgetType: 'simulation' } }],
      outline: { outlines: [], generationComplete: true, producer: 'server-job', requirement: `复用 ${info.version} 正式资料与实训`, createdAt: now, updatedAt: now },
    });
    await markStageGenerationComplete(pool, stageId);
  }
  const draft = service.saveDraft(task.id, actor, { requestId: `prepare:${input.requestId}`, expectedDraftSeq: 0, baseRevision: 0, content: extraTeachingPlan(caseId, stageId, sources) });
  await service.applyTask(task.id, actor, { requestId: `apply:${input.requestId}`, expectedDraftSeq: draft.draftSeq, expectedActiveRevision: 0 });
  return { taskId: task.id, stageIds: [stageId], reused: false };
}
