'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { currentServiceSettings } from '@/lib/settings/service-snapshot';
import { trainingFetch, trainingLearnerKey } from '@/lib/platform/training/client';
import type { TeachingSuggestion, TrainingAgentReply } from '@/lib/training/agent-contracts';
import type { EvidenceInput } from '@/lib/platform/training/contracts';

export function TrainingAgentPanel({
  taskId,
  revision,
  role,
  outputGroupId,
  evidenceId,
  intent = 'help',
  currentInput,
  onSuggestion,
  onReviewed,
}: {
  taskId: string;
  revision: number;
  role: 'teacher' | 'student';
  outputGroupId?: string;
  evidenceId?: string;
  intent?: 'help' | 'assess';
  currentInput?: EvidenceInput['submittedContent'];
  onSuggestion?: (suggestion: TeachingSuggestion) => void;
  onReviewed?: () => Promise<void>;
}) {
  const [conversationId, setConversationId] = useState('');
  const [message, setMessage] = useState('');
  const [replies, setReplies] = useState<TrainingAgentReply[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ id: string; content: string } | null>(null);
  const [pendingStorageKey, setPendingStorageKey] = useState('');
  useEffect(() => {
    let cancelled = false;
    setConversationId('');
    setPendingStorageKey('');
    setPending(null);
    setReplies([]);
    trainingLearnerKey(role)
      .then(async (learnerKey) => {
        if (cancelled) return;
        const key = `praxis:training-chat:${role}:${learnerKey}:${taskId}:${revision}:${outputGroupId ?? ''}:${evidenceId ?? ''}:${intent}`;
        let id = localStorage.getItem(key);
        if (!id) {
          id = crypto.randomUUID();
          localStorage.setItem(key, id);
        }
        const result = await trainingFetch<{ replies: TrainingAgentReply[] }>(
          `tasks/${taskId}/agent?conversationId=${id}`,
          role,
        );
        const pendingKey = `${key}:pending`;
        const raw = localStorage.getItem(pendingKey);
        const stored = raw ? JSON.parse(raw) : null;
        if (stored && (typeof stored.id !== 'string' || typeof stored.content !== 'string')) {
          throw new Error('本次请求的恢复记录无法读取，请保留已保存成果并联系维护人。');
        }
        const outstanding = stored && !result.replies.some((reply) => reply.requestId === stored.id)
          ? stored as { id: string; content: string }
          : null;
        if (!cancelled) {
          setConversationId(id);
          setPendingStorageKey(pendingKey);
          setPending(outstanding);
          setReplies(result.replies);
          if (outstanding && intent === 'help') {
            const previous = JSON.parse(outstanding.content);
            if (typeof previous.text === 'string') setMessage(previous.text);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, revision, role, outputGroupId, evidenceId, intent]);
  async function send() {
    const text =
      intent === 'assess'
        ? '请依据我本次已保存的原始成果和资料逐项评阅开放回答，解释判断依据及下一步。'
        : message.trim();
    const content = JSON.stringify({ text, currentInput });
    const request = pending?.content === content ? pending : { id: crypto.randomUUID(), content };
    setPending(request);
    setBusy(true);
    setError('');
    try {
      // Persist only request identity and input; service credentials stay in current settings.
      localStorage.setItem(pendingStorageKey, JSON.stringify(request));
      const reply = await trainingFetch<TrainingAgentReply>(`tasks/${taskId}/agent`, role, {
        conversationId,
        requestId: request.id,
        planRevision: revision,
        intent,
        message: text,
        outputGroupId,
        evidenceId,
        currentInput,
        serviceSettings: currentServiceSettings(),
      });
      setReplies((items) => [...items.filter((item) => item.requestId !== reply.requestId), reply]);
      setPending(null);
      try {
        localStorage.removeItem(pendingStorageKey);
      } catch {
        // A returned server reply also marks this request complete on the next load.
      }
      setMessage('');
      if (reply.assessmentSaved) await onReviewed?.();
    } catch (err) {
      setError((err as Error).message);
      try {
        await onReviewed?.();
      } catch {
        // Keep the original failure and the stable request available for retry.
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={
        intent === 'assess'
          ? 'AI 评阅与解释'
          : role === 'teacher'
            ? '教师 Agent 建议'
            : '学习 Agent 辅导'
      }
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <h5 className="font-semibold">
        {intent === 'assess'
          ? 'AI 评阅与解释'
          : role === 'teacher'
            ? '教师 Agent 建议'
            : '学习 Agent 辅导'}
      </h5>
      <p className="text-sm text-muted-foreground">
        {intent === 'assess'
          ? '根据已保存原文评阅开放回答；规则结果会继续保留。'
          : '说明你当前的困难，Agent 会读取本次任务和相关资料。'}
      </p>
      {intent === 'help' && (
        <label className="block space-y-2 text-sm">
          {role === 'teacher' ? '需要调整的教学问题' : '我卡在哪里'}
          <Textarea
            value={message}
            disabled={busy}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
      )}
      <Button
        variant="outline"
        disabled={busy || !conversationId || !pendingStorageKey || (intent === 'help' && !message.trim())}
        onClick={() => void send()}
      >
        {busy
          ? '正在读取资料并回应…'
          : intent === 'assess'
            ? pending
              ? '重试本次评阅'
              : '评阅本次开放回答'
            : pending
              ? '重试本次辅导'
              : '发送给 Agent'}
      </Button>
      {error && (
        <p role="alert" className="text-sm leading-6 text-destructive">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm">
          当前请求仍在处理中，可以继续查看已保存成果。
        </p>
      )}
      {replies.map((reply) => (
        <article key={reply.requestId} className="space-y-2 border-t border-border pt-3">
          <p className="whitespace-pre-wrap text-sm leading-7">{reply.content}</p>
          <p className="text-xs leading-6 text-muted-foreground">
            本次实际读取：
            {reply.sourceRefs.map((source) => `${source.sourceId} · ${source.title}`).join('；')}
          </p>
          {reply.suggestion?.supportAddition && onSuggestion && (
            <Button variant="outline" size="sm" onClick={() => onSuggestion(reply.suggestion!)}>
              填入调整草稿
            </Button>
          )}
          {reply.suggestion && !reply.suggestion.supportAddition && onSuggestion && <p className="text-xs text-muted-foreground">这条历史建议使用旧版整体替换格式。需要调整时请重新请求局部建议。</p>}
        </article>
      ))}
    </section>
  );
}
