'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrainingAgentPanel } from './agent-panel';
import { trainingLearnerKey, type TrainingTaskView } from '@/lib/platform/training/client';
import type { EvidenceInput } from '@/lib/platform/training/contracts';
import { interactiveDraftKey } from '@/lib/training/interactive-bridge';
import { codeEvidenceSchema } from '@/lib/training/code-acceptance';

export function InteractiveOutputEntry({ task, outputId }: { task: TrainingTaskView; outputId: string }) {
  const output = task.content!.outputs.find((item) => item.id === outputId)!;
  const activity = task.content!.activities.find((item) => item.outputGroupId === outputId)!;
  const [currentInput, setCurrentInput] = useState<EvidenceInput['submittedContent']>();
  const [revision, setRevision] = useState(task.revision);
  useEffect(() => {
    let active = true;
    void trainingLearnerKey('student').then((learner) => {
      const raw = localStorage.getItem(interactiveDraftKey('student', learner, task.id, outputId));
      if (!raw || !active) return;
      try { const saved = JSON.parse(raw); setRevision(saved.revision); setCurrentInput(saved.draft); } catch { /* The saved server evidence remains available below. */ }
    });
    return () => { active = false; };
  }, [task.id, outputId]);
  return <section className="space-y-3 border-t border-border pt-4">
    <h5 className="font-semibold">{output.title}</h5>
    <p className="whitespace-pre-wrap text-sm leading-7">{task.content!.supportNotes}</p>
    <Button asChild><Link href={`/classroom/${activity.stageId}?trainingTask=${task.id}&trainingDemo=1`}>进入实训并完成本次成果</Link></Button>
    <p className="text-sm text-muted-foreground">在实训中操作、核对当前结果并保存。保存后可回到本页刷新成果，继续评阅或由教师查看。</p>
    <TrainingAgentPanel key={revision} taskId={task.id} revision={revision} role="student" outputGroupId={outputId} currentInput={currentInput} />
  </section>;
}

export function CodeAcceptanceEvidence({ value }: { value: unknown }) {
  const parsed = codeEvidenceSchema.safeParse(value);
  if (!parsed.success) return <p>此代码记录的结构无法读取，请核对原始成果。</p>;
  const record = parsed.data;
  const run = record.run;
  const statuses = { completed: '已完整执行', source_error: '代码加载错误', timeout: '超时，未完成部分未执行', environment_unavailable: '环境未就绪', execution_error: '执行器中断' };
  return <div className="space-y-4 text-sm leading-7">
    <p><strong>契约理解：</strong>{record.contractUnderstanding}</p>
    <p><strong>代码来源：</strong>{record.codeSource} · 代码第 {record.codeRevision} 版</p>
    <pre className="overflow-auto rounded border bg-background p-3">{record.code}</pre>
    <p><strong>修改说明：</strong>{record.changeReason}</p>
    <p><strong>帮助与参考：</strong>{record.assistance || '未记录'}</p>
    <div className="overflow-auto"><table className="w-full text-left"><thead><tr><th>计划输入</th><th>学生预期</th><th>选择理由</th></tr></thead><tbody>{record.testPlan.map((row) => <tr key={row.id}><td className="p-2">{row.id} · {JSON.stringify(row.nums)} / {row.target}</td><td className="p-2">{row.expected}</td><td className="p-2">{row.reason}</td></tr>)}</tbody></table></div>
    {record.diagnostic && <div><p><strong>公开诊断：</strong>{record.diagnostic.runId} · 代码 {record.diagnostic.codeRevision} · {statuses[record.diagnostic.status]}</p><ul>{record.diagnostic.testPlan.map((input) => { const actual = record.diagnostic!.results.find((row) => row.caseId === input.id); return <li key={input.id}>{input.id}：学生预期 {input.expected}；契约预期 {input.nums.findIndex((n) => n === input.target)}；实际 {actual?.state === 'returned' ? `${actual.actualRepr} / ${actual.actualType}` : actual ? '运行错误，无返回值' : '未执行'}</li>; })}</ul></div>}
    <p><strong>固定运行：</strong>{run.runId} · {run.suiteVersion} · {statuses[run.status]} · 实际完成 {run.results.length}/12，返回值符合 {run.results.filter((row) => row.passed).length} 项</p>
    <p>{run.environment} · {run.startedAt} — {run.completedAt}{run.error && ` · ${run.error}`}</p>
    <p><strong>本次结论：</strong>{{ accept: '本次验证范围内接收', reject: '本次验证范围内拒收', unknown: '尚不能判断' }[record.conclusion]}</p>
    <p><strong>判断理由：</strong>{record.reasoning}</p><p><strong>未验证范围：</strong>{record.limitations}</p>
  </div>;
}
