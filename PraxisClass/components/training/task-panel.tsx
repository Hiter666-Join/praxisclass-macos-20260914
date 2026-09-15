'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSettingsMode } from '@/lib/store/settings-mode';
import { TaskSourceEditor, TaskSourceViewer } from './task-sources';
import { TrainingQuestionFields } from './question-fields';
import { TrainingAgentPanel } from './agent-panel';
import { InteractiveOutputEntry, CodeAcceptanceEvidence } from './interactive-output';
import { SimulationEvidence } from './simulation-output';
import { isSimulationCase } from '@/lib/training/simulation-evidence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getDocumentStore } from '@/lib/document-store/store';
import {
  trainingFetch,
  trainingLearnerKey,
  type TrainingTaskView,
  type TrainingEvidenceView,
  type TrainingEvidenceList,
} from '@/lib/platform/training/client';
import {
  type TeachingPlan,
  type EvidenceInput,
  canonical,
  evidenceInputSchema,
  planSchema,
} from '@/lib/platform/training/contracts';

export function TrainingTaskEntry({ role }: { role: 'teacher' | 'student' }) {
  const params = useSearchParams();
  const taskId = params.get('trainingTask');
  const mode = useSettingsMode((state) => state.mode);
  const [task, setTask] = useState<TrainingTaskView | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!taskId) return;
    const loaded = await trainingFetch<TrainingTaskView>(
      `tasks/${encodeURIComponent(taskId)}`,
      role,
    );
    setTask(loaded);
  }, [taskId, role]);
  useEffect(() => {
    if (!taskId || mode !== role) return;
    let cancelled = false;
    trainingFetch<TrainingTaskView>(`tasks/${encodeURIComponent(taskId)}`, role)
      .then((loaded) => {
        if (!cancelled) {
          setTask(loaded);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, role, taskId]);
  if (!taskId) return null;
  return (
    <section className="mb-6 space-y-4" aria-label="当前实训任务">
      {role === 'student' && (
        <p className="text-sm">
          本次演练提交独立保存。
          <Link
            className="ml-2 underline"
            onClick={() => useSettingsMode.getState().setMode('teacher')}
            href={`/teacher?trainingTask=${taskId}&trainingDemo=1`}
          >
            返回教师回看
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {task && <TaskDetail key={`${task.id}:${role}`} task={task} role={role} reload={reload} />}
    </section>
  );
}

export function TrainingTaskPanel({
  stageId,
  title,
  student = false,
}: {
  stageId: string;
  title: string;
  student?: boolean;
}) {
  const role = student ? 'student' : 'teacher';
  const [tasks, setTasks] = useState<TrainingTaskView[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createId] = useState(() => crypto.randomUUID());
  const [creating, setCreating] = useState(false);
  const [activities, setActivities] = useState<{ id: string; title: string }[]>([]);
  const [sceneId, setSceneId] = useState('');
  const [taskGoal, setTaskGoal] = useState('');
  const [criterion, setCriterion] = useState('');
  const reload = useCallback(async () => {
    const result = await trainingFetch<{ tasks: TrainingTaskView[] }>(
      `tasks?stageId=${encodeURIComponent(stageId)}`,
      role,
    );
    setTasks(result.tasks);
  }, [stageId, role]);
  useEffect(() => {
    reload().catch((err) => setError(err.message));
  }, [reload]);
  async function prepareCreate() {
    setError('');
    setBusy(true);
    try {
      const doc = await getDocumentStore().loadDocument(stageId);
      setActivities(doc?.scenes.map(scene => ({ id: scene.id, title: scene.title })) ?? []);
      setCreating(true);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function create() {
    setBusy(true);
    setError('');
    try {
      const doc = await getDocumentStore().loadDocument(stageId);
      const scene = doc?.scenes.find(item => item.id === sceneId);
      if (!scene) throw new Error('课堂还没有可关联的活动，请先准备活动。');
      if (!taskGoal.trim() || !criterion.trim()) throw new Error('请填写实际任务与评阅标准。');
      const plan: TeachingPlan = {
        schemaVersion: 1,
        title: `${title}：实训成果`,
        professionalGroup: '',
        occupation: '',
        jobTask: taskGoal.trim(),
        learnerProfile: '',
        learningGoals: [taskGoal.trim()],
        sources: [],
        competencies: [
          {
            id: 'reasoning',
            name: '本次任务',
            description: taskGoal.trim(),
            checkIds: ['reasoning'],
          },
        ],
        checks: [
          {
            id: 'reasoning',
            revision: 1,
            criterion: criterion.trim(),
            required: true,
            appliesWhen: 'always',
            evaluator: 'human',
            sourceRefs: [],
          },
        ],
        outputs: [
          {
            id: 'output',
            title: '本次实训说明',
            requiredParts: ['我的操作与解释'],
            activityRefs: [scene.id],
            checkRefs: ['reasoning'],
          },
        ],
        activities: [
          {
            stageId,
            sceneId: scene.id,
            purpose: scene.title,
            outputGroupId: 'output',
            checkRefs: ['reasoning'],
            contentRevision: '1',
            required: true,
          },
        ],
        supportNotes: '',
        orderedActivityRefs: [scene.id],
        changeReason: '教师选择课堂活动并建立成果要求',
        basedOnEvidenceIds: [],
      };
      await trainingFetch('tasks', role, { requestId: createId, content: plan });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="实训要求与成果">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {tasks.length === 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            {student
              ? '此课堂尚未应用实训安排。'
              : '选择现有课堂活动，填写任务与评阅标准。这里只保存实训要求，不会修改课堂页面。'}
          </p>
          {!student && (creating ? (
            <div className="space-y-3">
              <label className="block space-y-2 text-sm">关联课堂活动
                <select aria-label="关联课堂活动" value={sceneId} onChange={event => setSceneId(event.target.value)} className="w-full rounded-md border border-border bg-background p-2">
                  <option value="">请选择实际活动</option>
                  {activities.map(activity => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
                </select>
              </label>
              {!activities.length && <p className="text-sm text-muted-foreground">课堂暂无活动，请先准备课堂。</p>}
              <label className="block space-y-2 text-sm">本次任务与目标
                <Textarea value={taskGoal} onChange={event => setTaskGoal(event.target.value)} maxLength={12000} />
              </label>
              <label className="block space-y-2 text-sm">成果评阅标准
                <Textarea value={criterion} onChange={event => setCriterion(event.target.value)} maxLength={12000} />
              </label>
              <Button disabled={busy || !sceneId || !taskGoal.trim() || !criterion.trim()} onClick={create}>建立要求草稿</Button>
            </div>
          ) : <Button disabled={busy} onClick={prepareCreate}>添加实训要求</Button>)}
        </>
      ) : (
        tasks.map((task) => (
          <TaskDetail key={`${task.id}:${role}`} task={task} role={role} reload={reload} />
        ))
      )}
      <Button
        variant="outline"
        onClick={() => {
          setError('');
          reload().catch((err) => setError(err.message));
        }}
      >
        刷新实训记录
      </Button>
    </section>
  );
}

function TaskDetail({
  task,
  role,
  reload,
}: {
  task: TrainingTaskView;
  role: 'teacher' | 'student';
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(task.draft ?? task.content!);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<{
    encoded: string;
    id: string;
    expectedDraftSeq: number;
    baseRevision: number;
  } | null>(null);
  const [records, setRecords] = useState<TrainingEvidenceList | null>(null);
  const [recordKind, setRecordKind] = useState<'learning' | 'demo'>(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('trainingDemo') === '1'
      ? 'demo'
      : 'learning',
  );
  const [selected, setSelected] = useState<TrainingEvidenceView | null>(null);
  const loadRecords = useCallback(
    async () =>
      setRecords(
        await trainingFetch<TrainingEvidenceList>(
          `tasks/${task.id}/evidence?scope=${role === 'teacher' ? 'teacher' : 'self'}&recordKind=${recordKind}`,
          role,
        ),
      ),
    [task.id, role, recordKind],
  );
  useEffect(() => {
    loadRecords().catch((err) => setError(err.message));
  }, [loadRecords]);
  async function apply() {
    setBusy(true);
    setError('');
    setNotice('');
    const encoded = canonical(draft);
    const pending =
      request?.encoded === encoded
        ? request
        : {
            encoded,
            id: crypto.randomUUID(),
            expectedDraftSeq: task.draftSeq!,
            baseRevision: task.activeRevision,
          };
    const id = pending.id;
    setRequest(pending);
    try {
      const saved = await trainingFetch<{ draftSeq: number }>(
        `tasks/${task.id}/draft`,
        role,
        {
          requestId: id,
          expectedDraftSeq: pending.expectedDraftSeq,
          baseRevision: pending.baseRevision,
          content: draft,
        },
        'PUT',
      );
      const applied = await trainingFetch<{ revision: number }>(`tasks/${task.id}/apply`, role, {
        requestId: `apply:${id}`,
        expectedDraftSeq: saved.draftSeq,
        expectedActiveRevision: pending.baseRevision,
      });
      setNotice(`实训要求第 ${applied.revision} 版已保存并供学生使用，课堂页面未修改。`);
      setRequest(null);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <h4 className="font-semibold">{task.content?.title ?? draft.title}</h4>
      <p className="text-sm text-muted-foreground">
        {task.activeRevision ? `当前方案第 ${task.activeRevision} 版` : '草稿尚未应用'}
      </p>
      {task.content && (
        <div className="flex flex-wrap gap-2">
          {task.content.orderedActivityRefs.map((sceneId) => {
            const activity = task.content!.activities.find((item) => item.sceneId === sceneId)!;
            return (
              <Button key={sceneId} variant="outline" size="sm" asChild>
                <Link
                  href={`/classroom/${activity.stageId}?trainingTask=${task.id}&trainingDemo=1`}
                >
                  {activity.purpose}
                </Link>
              </Button>
            );
          })}
        </div>
      )}
      {role === 'teacher' ? (
        <>
          <details className="space-y-4" open={!task.activeRevision}>
          <summary className="cursor-pointer text-sm font-medium">调整实训要求</summary>
          <p className="text-sm text-muted-foreground">保存后学生按此版本提交成果；课堂内容需在课堂编辑中单独调整。</p>
          <label className="block space-y-2 text-sm">
            任务名称
            <Input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <label className="block space-y-2 text-sm">专业方向（可选）
            <Input value={draft.professionalGroup} onChange={event => setDraft({ ...draft, professionalGroup: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm">岗位（可选）
            <Input value={draft.occupation} onChange={event => setDraft({ ...draft, occupation: event.target.value })} />
          </label>
          <label className="block space-y-2 text-sm">本次任务
            <Textarea value={draft.jobTask} onChange={event => setDraft({ ...draft, jobTask: event.target.value,
              ...(draft.learningGoals.length === 1 && draft.learningGoals[0] === draft.jobTask ? { learningGoals: [event.target.value] } : {}) })} />
          </label>
          {draft.checks.map((check, index) => <label key={check.id} className="block space-y-2 text-sm">
            成果标准 {index + 1}{check.evaluator === 'rule' ? '（固定规则）' : ''}
            <Textarea value={check.criterion} readOnly={check.evaluator === 'rule'} onChange={event => setDraft({ ...draft, checks: draft.checks.map((item, i) => i === index ? { ...item, criterion: event.target.value, revision: (task.content?.checks.find(original => original.id === item.id)?.revision ?? item.revision) + 1 } : item) })} />
          </label>)}
          <label className="block space-y-2 text-sm">
            学情
            <Textarea
              value={draft.learnerProfile}
              onChange={(event) => setDraft({ ...draft, learnerProfile: event.target.value })}
            />
          </label>
          <label className="block space-y-2 text-sm">
            本次教学支持
            <Textarea
              id={`training-support-${task.id}`}
              value={draft.supportNotes}
              onChange={(event) => setDraft({ ...draft, supportNotes: event.target.value })}
            />
          </label>
          <label className="block space-y-2 text-sm">
            调整理由
            <Textarea
              value={draft.changeReason}
              onChange={(event) => setDraft({ ...draft, changeReason: event.target.value })}
            />
          </label>
          {draft.basedOnEvidenceIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>本次调整依据：{draft.basedOnEvidenceIds.length}份已保存成果</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft((current) => ({ ...current, basedOnEvidenceIds: [] }))}
              >
                清除成果依据
              </Button>
            </div>
          )}
          <TaskSourceEditor
            sources={draft.sources}
            onChange={(sources) => setDraft((current) => ({ ...current, sources }))}
          />
          {task.activeRevision > 0 && (
            <TrainingAgentPanel
              key={`teacher:${task.activeRevision}`}
              taskId={task.id}
              revision={task.activeRevision}
              role="teacher"
              currentInput={{
                learnerProfile: draft.learnerProfile,
                supportNotes: draft.supportNotes,
                selectedEvidenceId: selected?.evidenceId ?? null,
              }}
              onSuggestion={(suggestion) => {
                if (!suggestion.supportAddition) return;
                const addition = suggestion.supportAddition.trim();
                const supportNotes = draft.supportNotes.trimEnd() + '\n\n' + addition;
                if (supportNotes.length > 12000) {
                  setError('教学支持合并后过长，请精简当前草稿或要求 Agent 缩短新增段落。');
                  return;
                }
                setDraft((current) => ({
                  ...current,
                  ...(suggestion.learnerProfile === undefined ? {} : { learnerProfile: suggestion.learnerProfile }),
                  supportNotes,
                  changeReason: suggestion.changeReason,
                  basedOnEvidenceIds: suggestion.basedOnEvidenceIds,
                }));
                setNotice('建议已填入实训要求草稿，请核对后保存；课堂页面未修改。');
              }}
            />
          )}
          <Button disabled={busy} onClick={apply}>
            {busy ? '正在保存…' : '保存实训要求并供学生使用'}
          </Button>
          </details>
          {task.activeRevision > 0 && <Button asChild variant="outline">
            <Link
              onClick={() => useSettingsMode.getState().setMode('student')}
              href={`/student?trainingTask=${task.id}&trainingStage=${encodeURIComponent(draft.activities[0].stageId)}&trainingDemo=1`}
            >
              以本次体验者进入
            </Link>
          </Button>}
        </>
      ) : (
        task.content && (
          <StudentSubmission
            key={task.id}
            task={task}
            onSaved={async (result) => {
              setSelected(result);
              await loadRecords();
            }}
          />
        )
      )}
      {task.content && (
        <TaskSourceViewer
          taskId={task.id}
          revision={task.revision}
          sources={task.content.sources}
          role={role}
        />
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h5 className="mr-auto font-medium">
          {role === 'teacher' ? '本任务学习证据' : '我的已提交成果'}
        </h5>
        {role === 'teacher' && (
          <select
            aria-label="成果记录范围"
            className="rounded border bg-background p-2 text-sm"
            value={recordKind}
            onChange={(event) => {
              setRecordKind(event.target.value as 'learning' | 'demo');
              setSelected(null);
            }}
          >
            <option value="learning">学习记录</option>
            <option value="demo">演练记录</option>
          </select>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadRecords().catch((err) => setError(err.message))}
        >
          刷新成果
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        本页已保存 {records?.savedCountInPage ?? 0} 份，待完成 {records?.pendingCountInPage ?? 0}{' '}
        份。{records?.nextCursor ? '仅显示前50份。' : ''}
      </p>
      <ul className="space-y-2">
        {records?.items.map((item, index) => (
          <li key={item.evidenceId}>
            <Button
              data-evidence-id={item.evidenceId}
              className="h-auto w-full justify-start whitespace-normal text-left"
              variant="outline"
              onClick={async () => {
                try {
                  setSelected(
                    await trainingFetch<TrainingEvidenceView>(`evidence/${item.evidenceId}`, role),
                  );
                  await loadRecords();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              查看成果 {index + 1} · {task.content?.outputs.find((output) => output.id === item.outputGroupId)?.title ?? item.outputGroupId} · 方案 {item.planRevision} ·{' '}
              {new Date(item.createdAt).toLocaleString()}
            </Button>
          </li>
        ))}
      </ul>
      {selected && (
        <>
          <EvidenceDetail evidence={selected} />
          {role === 'teacher' && selected.submission && (
            <Button
              variant="outline"
              onClick={() => {
                setDraft((current) => ({
                  ...current,
                  basedOnEvidenceIds: [...new Set([...current.basedOnEvidenceIds, selected.evidenceId])],
                }));
                setNotice('已将当前成果作为调整依据；请修改教学支持并应用。');
                document.getElementById(`training-support-${task.id}`)?.focus();
              }}
            >
              将本成果作为调整依据
            </Button>
          )}
          {selected.submission?.contextSnapshot.checks.some(
            (check) => check.evaluator === 'ai',
          ) && (
            <TrainingAgentPanel
              key={`assess:${selected.evidenceId}`}
              taskId={task.id}
              revision={selected.planRevision}
              role={role}
              evidenceId={selected.evidenceId}
              intent="assess"
              onReviewed={async () => {
                setSelected(
                  await trainingFetch<TrainingEvidenceView>(
                    `evidence/${selected.evidenceId}`,
                    role,
                  ),
                );
                await loadRecords();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function StudentSubmission({
  task,
  onSaved,
}: {
  task: TrainingTaskView;
  onSaved: (result: TrainingEvidenceView) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6">{task.content!.jobTask}</p>
      {task.content!.outputs.map((output) => (
        output.interaction
          ? <InteractiveOutputEntry key={output.id} task={task} outputId={output.id} />
          : <OutputSubmission key={output.id} task={task} outputId={output.id} onSaved={onSaved} />
      ))}
    </div>
  );
}

function OutputSubmission({
  task,
  outputId,
  onSaved,
}: {
  task: TrainingTaskView;
  outputId: string;
  onSaved: (result: TrainingEvidenceView) => Promise<void>;
}) {
  const [boundPlan, setBoundPlan] = useState(task.content!);
  const [input, setInput] = useState<EvidenceInput>(() => {
    const activity = task.content!.activities.find((item) => item.outputGroupId === outputId)!;
    return {
      evidenceId: crypto.randomUUID(),
      nativeAttemptId: crypto.randomUUID(),
      taskId: task.id,
      planRevision: task.revision,
      outputGroupId: outputId,
      stageId: activity.stageId,
      sceneId: activity.sceneId,
      sourceRecordRefs: [],
      submittedContent: {},
    };
  });
  const [storageKey, setStorageKey] = useState('');
  const [locked, setLocked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const output = boundPlan.outputs.find((item) => item.id === outputId)!;
  useEffect(() => {
    let active = true;
    trainingLearnerKey('student')
      .then(async (learnerKey) => {
        if (!active) return;
        const key = `praxis:training-draft:${learnerKey}:${task.id}:${outputId}`;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const stored = JSON.parse(raw);
            const parsedInput = evidenceInputSchema.parse(stored.input);
            const parsedPlan = planSchema.parse(stored.plan);
            if (
              parsedInput.taskId !== task.id ||
              parsedInput.outputGroupId !== outputId ||
              !parsedPlan.outputs.some((item) => item.id === outputId)
            )
              throw new Error('草稿绑定不一致。');
            setInput(parsedInput);
            setBoundPlan(parsedPlan);
            setLocked(stored.locked === true);
            if (stored.locked) {
              try {
                const result = await trainingFetch<TrainingEvidenceView>(
                  `evidence/${parsedInput.evidenceId}`,
                  'student',
                );
                if (!active) return;
                setSaved(result.processing.saved === 'server');
                if (result.submission) await onSaved(result);
              } catch {
                if (active) setMessage('上次保存尚未确认，请重试同一次提交。');
              }
            }
          }
        } catch {
          setMessage('本机草稿暂不可恢复，请确认已提交成果后继续。');
        }
        if (active) setStorageKey(key);
      })
      .catch((err) => setMessage(err.message));
    return () => {
      active = false;
    };
    // Binding restoration runs once for this learner/task/output, never on a plan refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, outputId]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ input, plan: boundPlan, locked }));
    } catch {
      setMessage('本机草稿未保存成功；当前输入仅在此页面保留。');
    }
  }, [storageKey, input, boundPlan, locked]);
  async function submit() {
    setBusy(true);
    setLocked(true);
    setMessage('');
    try {
      const result = await trainingFetch<TrainingEvidenceView>('evidence', 'student', input);
      setSaved(result.processing.saved === 'server');
      setMessage(
        result.processing.saved === 'server'
          ? '已保存到服务端，可刷新或由教师回看。'
          : '原文保存尚未确认，请重试。',
      );
      await onSaved(result);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h5 className="font-semibold">{output.title}</h5>
      <p className="text-sm text-muted-foreground">
        作答绑定方案第 {input.planRevision} 版。{boundPlan.supportNotes}
      </p>
      {input.planRevision !== task.activeRevision && (
        <p className="text-sm">教学安排已有更新；当前作答继续使用开始时的方案。</p>
      )}
      {output.questions ? (
        <TrainingQuestionFields
          output={output}
          content={input.submittedContent}
          disabled={locked || busy || !storageKey}
          onChange={(submittedContent) => setInput({ ...input, submittedContent })}
        />
      ) : (
        output.requiredParts.map((part) => (
          <label key={part} className="block space-y-2 text-sm">
            {part}
            <Textarea
              disabled={locked || busy || !storageKey}
              value={String(input.submittedContent[part] ?? '')}
              onChange={(event) =>
                setInput({
                  ...input,
                  submittedContent: { ...input.submittedContent, [part]: event.target.value },
                })
              }
            />
          </label>
        ))
      )}
      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
        {boundPlan.checks
          .filter((check) => output.checkRefs.includes(check.id))
          .map((check) => (
            <li key={check.id}>{check.criterion}</li>
          ))}
      </ul>
      <TrainingAgentPanel
        key={`student:${input.planRevision}:${output.id}`}
        taskId={task.id}
        revision={input.planRevision}
        role="student"
        outputGroupId={output.id}
        currentInput={input.submittedContent}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            busy ||
            !storageKey ||
            output.requiredParts.some((part) => !String(input.submittedContent[part] ?? '').trim())
          }
          onClick={submit}
        >
          {busy ? '正在保存…' : locked ? '重试同一次保存' : '提交并查看反馈'}
        </Button>
        {saved && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setInput({
                ...input,
                evidenceId: crypto.randomUUID(),
                nativeAttemptId: crypto.randomUUID(),
                supersedesEvidenceId: input.evidenceId,
              });
              setLocked(false);
              setSaved(false);
              setMessage('修改后提交会保留上一份原文，并建立修订关系。');
            }}
          >
            修改后再提交
          </Button>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm leading-6">
          {message}
        </p>
      )}
    </div>
  );
}

export function EvidenceDetail({ evidence }: { evidence: TrainingEvidenceView }) {
  const questions = evidence.submission?.contextSnapshot.outputs[0]?.questions;
  const content = evidence.submission?.submittedContent ?? {};
  const entries = questions
    ? questions.filter((question) => Object.hasOwn(content, question.id)).map((question) => [question.id, content[question.id]] as const)
    : Object.entries(content);
  const statuses = {
    unassessed: '未评估',
    pending: '待确认',
    needs_work: '需加强',
    achieved: '已达标',
  };
  const checks = { passed: '满足', failed: '未满足', unknown: '待确认', not_applicable: '不适用' };
  return (
    <section aria-label="本次成果原文" className="space-y-4 rounded-lg bg-muted/40 p-4">
      <h5 className="font-semibold">本次成果原文</h5>
      <p role="status" className="text-sm">
        {evidence.processing.saved === 'server' ? '已保存到服务端' : '原文尚未保存'} ·{' '}
        {evidence.recordKind === 'demo' ? '演练记录' : '学习记录'} · 方案 {evidence.planRevision}
      </p>
      {evidence.submission &&
        entries.map(([label, value]) => {
          if (label === '验收记录' && evidence.submission?.contextSnapshot.outputs[0]?.interaction === 'ai-code') return <CodeAcceptanceEvidence key={label} value={value} />;
          const interaction = evidence.submission?.contextSnapshot.outputs[0]?.interaction;
          if (isSimulationCase(interaction)) return <SimulationEvidence key={label} caseId={interaction} value={value} />;
          const question = evidence.submission!.contextSnapshot.outputs[0]?.questions?.find((item) => item.id === label);
          const displayed = question?.options && Array.isArray(value)
            ? value.map((selected) => question.options!.find((option) => option.value === selected)?.label ?? String(selected)).join('\n')
            : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
          return <div key={label}>
            <p className="text-sm font-medium">{question?.question ?? label}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{displayed}</p>
          </div>;
        })}
      {evidence.assessment?.checkResults.map((result) => (
        <div key={result.checkId} className="text-sm leading-6">
          <p className="font-medium">
            {
              evidence.submission?.contextSnapshot.checks.find(
                (check) => check.id === result.checkId,
              )?.criterion
            }
            ：{checks[result.status]}
          </p>
          <p>{result.basis}</p>
        </div>
      ))}
      {evidence.assessment?.competencyResults.map((item) => (
        <p key={item.competencyId} className="text-sm">
          {
            evidence.submission?.contextSnapshot.competencies.find(
              (competency) => competency.id === item.competencyId,
            )?.name
          }
          ：{statuses[item.status]}
        </p>
      ))}
      {evidence.processing.assessment === 'failed' && (
        <p className="text-sm">成果原文已保存，评价暂未完成；重新读取可恢复缺失步骤。</p>
      )}
      {evidence.processing.index === 'failed' && (
        <p className="text-sm">原文和已完成的评价仍可查看，成果列表暂未同步；重新打开本成果可恢复列表状态。</p>
      )}
      {evidence.explanation && (
        <div className="space-y-2">
          <h6 className="font-semibold">本次评阅解释</h6>
          <p className="whitespace-pre-wrap text-sm leading-7">{evidence.explanation.content}</p>
        </div>
      )}
      {evidence.processing.explanation === 'pending' && (
        <p className="text-sm">评价已保存，解释尚未完成，可重试本次评阅。</p>
      )}
      <p className="text-xs text-muted-foreground">成果编号：{evidence.evidenceId}</p>
    </section>
  );
}
