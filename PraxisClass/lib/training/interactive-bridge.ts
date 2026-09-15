'use client';

import { z } from 'zod';
import { useSettingsMode } from '@/lib/store/settings-mode';
import { currentServiceSettings } from '@/lib/settings/service-snapshot';
import { trainingFetch, trainingLearnerKey, TrainingRequestError, type TrainingTaskView, type TrainingEvidenceView } from '@/lib/platform/training/client';
import { canonical, type EvidenceInput } from '@/lib/platform/training/contracts';
import type { TrainingAgentReply } from './agent-contracts';
import { parseInteractiveResults } from '@/lib/platform/mirror/interactive-results';
import { mirrorMany } from '@/lib/platform/mirror/client';
import { codeEvidenceSchema } from './code-acceptance';

const messageSchema = z.object({
  type: z.literal('praxis:training'), version: z.literal(1),
  action: z.enum(['ready', 'draft', 'save', 'help', 'return']), requestId: z.uuid(),
  state: z.record(z.string(), z.json()).optional(),
  submittedContent: z.record(z.string(), z.json()).optional(),
  message: z.string().max(4000).optional(),
});
type Cache = { revision: number; draft?: z.infer<typeof messageSchema>['state']; pending?: EvidenceInput; last?: EvidenceInput; conversationId?: string };
export function interactiveDraftKey(role: string, learner: string, taskId: string, outputId: string) {
  return `praxis:training-interaction:${role}:${learner}:${taskId}:${outputId}`;
}

/** Only the registered, visible iframe may use this bridge. Identity and binding come from the host. */
export function createTrainingInteractiveBridge(scope: {
  stageId: string; sceneId: string; post: (data: unknown) => void; isCurrent: () => boolean;
}) {
  let context: Promise<{ task: TrainingTaskView; outputId: string; role: 'teacher' | 'student'; learner: string; key: string; cache: Cache }> | null = null;
  let saving = false;
  const open = () => context ??= (async () => {
    const taskId = new URLSearchParams(window.location.search).get('trainingTask');
    if (!taskId) throw new Error('请从本次任务的实训入口进入，才能关联和保存成果。');
    const role = useSettingsMode.getState().mode;
    const learner = await trainingLearnerKey(role);
    let task = await trainingFetch<TrainingTaskView>(`tasks/${encodeURIComponent(taskId)}`, role);
    const activity = task.content?.activities.find((a) => a.stageId === scope.stageId && a.sceneId === scope.sceneId);
    const output = task.content?.outputs.find((o) => o.id === activity?.outputGroupId);
    if (!output?.interaction) throw new Error('本次任务未关联可保存的互动成果。');
    const key = interactiveDraftKey(role, learner, task.id, output.id);
    const raw = localStorage.getItem(key);
    const cache: Cache = raw ? JSON.parse(raw) : { revision: task.revision };
    if (cache.revision !== task.revision) task = await trainingFetch<TrainingTaskView>(`tasks/${task.id}?revision=${cache.revision}`, role);
    if (!task.content?.activities.some((a) => a.sceneId === scope.sceneId && a.stageId === scope.stageId && a.outputGroupId === output.id)) throw new Error('已保存草稿的方案与当前活动不对应。');
    localStorage.setItem(key, JSON.stringify(cache));
    return { task, outputId: output.id, role, learner, key, cache };
  })();
  return async (raw: unknown) => {
    const parsed = messageSchema.safeParse(raw);
    if (!parsed.success || !scope.isCurrent()) return;
    const msg = parsed.data;
    const reply = (value: unknown) => {
      if (scope.isCurrent()) scope.post({ type: 'praxis:training-reply', version: 1, requestId: msg.requestId, action: msg.action, ...value as object });
    };
    try {
      if (JSON.stringify(msg).length > 180000) throw new Error('本次互动内容过长，请减少无关内容。');
      const ctx = await open();
      if (!scope.isCurrent() || ctx.role !== useSettingsMode.getState().mode || ctx.learner !== await trainingLearnerKey(ctx.role)) throw new Error('当前角色已变化，请重新进入本次任务。');
      const persist = () => localStorage.setItem(ctx.key, JSON.stringify(ctx.cache));
      if (msg.action === 'return') {
        if (ctx.role === 'student' && msg.state) { ctx.cache.draft = msg.state; persist(); }
        window.location.assign(`/${ctx.role}?trainingTask=${ctx.task.id}&trainingDemo=1`);
        return;
      }
      if (msg.action === 'ready') {
        let replies: TrainingAgentReply[] = [];
        let historyUnavailable = false;
        if (ctx.cache.conversationId) {
          try { replies = (await trainingFetch<{ replies: TrainingAgentReply[] }>(`tasks/${ctx.task.id}/agent?conversationId=${ctx.cache.conversationId}`, ctx.role)).replies; }
          catch { historyUnavailable = true; }
        }
        reply({ ok: true, role: ctx.role, taskId: ctx.task.id, revision: ctx.cache.revision, state: ctx.cache.draft, pending: Boolean(ctx.cache.pending), evidenceId: ctx.cache.last?.evidenceId, replies, historyUnavailable, returnPath: `/student?trainingTask=${ctx.task.id}&trainingDemo=1` });
        return;
      }
      if (ctx.role !== 'student') throw new Error('教师当前为预览。请返回任务并选择“以本次体验者进入”后提交。');
      if (msg.action === 'draft') {
        ctx.cache.draft = msg.state;
        persist();
        return;
      }
      if (msg.action === 'help') {
        if (!msg.message?.trim()) throw new Error('请说明当前困难。');
        ctx.cache.conversationId ??= crypto.randomUUID();
        persist();
        const result = await trainingFetch<TrainingAgentReply>(`tasks/${ctx.task.id}/agent`, 'student', {
          conversationId: ctx.cache.conversationId, requestId: msg.requestId, planRevision: ctx.cache.revision,
          outputGroupId: ctx.outputId, intent: 'help', message: msg.message,
          currentInput: msg.state ?? ctx.cache.draft ?? {}, serviceSettings: currentServiceSettings(),
        });
        reply({ ok: true, content: result.content, sources: result.sourceRefs });
        return;
      }
      if (!msg.submittedContent) throw new Error('请先完成本次成果。');
      if (saving) throw new Error('本次保存仍在处理中，请稍后核对回执。');
      saving = true;
      try {
        const same = (input?: EvidenceInput) => input && canonical(input.submittedContent) === canonical(msg.submittedContent);
        if (ctx.cache.pending && !same(ctx.cache.pending)) throw new Error('上次保存尚未确认，请先重试同一次保存。');
        const input: EvidenceInput = same(ctx.cache.pending) ? ctx.cache.pending! : same(ctx.cache.last) ? ctx.cache.last! : {
          evidenceId: crypto.randomUUID(), nativeAttemptId: crypto.randomUUID(), taskId: ctx.task.id,
          planRevision: ctx.cache.revision, outputGroupId: ctx.outputId, stageId: scope.stageId, sceneId: scope.sceneId,
          submittedContent: msg.submittedContent, sourceRecordRefs: [],
          ...(ctx.cache.last ? { supersedesEvidenceId: ctx.cache.last.evidenceId } : {}),
        };
        ctx.cache.pending = input;
        persist();
        const result = await trainingFetch<TrainingEvidenceView>('evidence', 'student', input);
        if (result.processing.saved !== 'server') throw new Error('原文保存尚未确认，请重试同一次保存。');
        ctx.cache.last = input;
        delete ctx.cache.pending;
        persist();
        const code = codeEvidenceSchema.safeParse(input.submittedContent['验收记录']);
        if (code.success && code.data.run.results.length) mirrorMany(parseInteractiveResults({
          type: 'praxis:code-test-results', version: 1, suite: 'case_a_algo', attemptId: code.data.run.runId,
          results: code.data.run.results,
        }, { stageId: scope.stageId, sceneId: scope.sceneId, learnerKey: ctx.learner }));
        reply({ ok: true, evidenceId: result.evidenceId, planRevision: result.planRevision, processing: result.processing });
      } catch (error) {
        // Validation fails before reservation; allow correction instead of locking an invalid payload.
        if (error instanceof TrainingRequestError && error.status === 422) {
          delete ctx.cache.pending;
          persist();
          reply({ ok: false, editable: true, message: error.message });
          return;
        }
        throw error;
      } finally { saving = false; }
    } catch (error) {
      reply({ ok: false, message: error instanceof Error ? error.message : '本次操作未完成，请保留当前输入。' });
      if (msg.action === 'ready') context = null;
    }
  };
}
