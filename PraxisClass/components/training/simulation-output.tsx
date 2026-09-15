'use client';

import { retryEvidenceSchema, visionEvidenceSchema, warehouseEvidenceSchema, type SimulationCase } from '@/lib/training/simulation-evidence';

export function SimulationEvidence({ caseId, value }: { caseId: SimulationCase; value: unknown }) {
  const unavailable = <p>此实训记录无法读取，请核对原始成果。</p>;
  if (caseId === 'retry') {
    const parsed = retryEvidenceSchema.safeParse(value); if (!parsed.success) return unavailable;
    const r = parsed.data;
    return <div className="space-y-4 whitespace-pre-wrap text-sm leading-7">
      <p><strong>方案 {r.designRevision}：</strong>{r.design.mode === 'dedupe' ? '按调用者与标识去重' : '未去重'}；重试{r.design.retryKey === 'same' ? '沿用' : '更换'}标识；新需求{r.design.newKey === 'new' ? '更换' : '沿用'}标识。</p>
      <p>{r.rulesReason}</p>
      {r.rounds.map((o) => <section key={o.runId} className="rounded border p-3"><p><strong>{o.scenario}</strong> · {o.runId} · {o.conflict ? '含参数冲突选做' : '基本验证'}</p>
        <p>判断：{o.judgment.conclusion}。{o.judgment.reason}；当时{o.judgment.observed ? '已展开全景' : '仅看客户端'}，{o.judgment.assisted ? '已获得辅导' : '未记录关键辅导'}。</p>
        <p>预测 {o.prediction.total} 张：{o.prediction.reason}</p><p>实际 {o.result.total} 张；收到编号 [{o.result.client.received.join(', ')}]。</p>
        <ul>{o.result.events.map((event) => <li key={event.seq}>第{event.seq}次 · {event.intent} · {event.operationId} / {event.payload} → {event.network} → {event.server} → {event.response}</li>)}</ul><p>{o.explanation}</p>
      </section>)}
      <p><strong>结论：</strong>{r.conclusion}</p><p><strong>范围：</strong>{r.limitations}</p><p><strong>帮助：</strong>{r.assistance || '未记录'}</p>
    </div>;
  }
  if (caseId === 'vision') {
    const parsed = visionEvidenceSchema.safeParse(value); if (!parsed.success) return unavailable;
    const r = parsed.data;
    return <div className="space-y-4 whitespace-pre-wrap text-sm leading-7">
      <p>VISION-WASHER 1.0 · VISION-GTE 1.0 · 0–100 整数教学刻度</p>
      {r.observations.map((o) => <section key={o.runId} className="rounded border p-3"><p><strong>阈值 {o.threshold} · {o.condition}</strong> · {o.runId}{o.runId === r.finalRunId && ' · 基础最终选择'}</p><p>预测：{o.prediction}</p>
        <p>TP/FN/FP/TN：{o.result.TP}/{o.result.FN}/{o.result.FP}/{o.result.TN}；复检 {o.result.review}/{o.result.maxReview}；准确率 {o.result.accuracy * 100}%。</p>
        <p>{o.result.groups.map((s) => `${s.id}(${s.score}) ${s.destination === 'review' ? '复检' : '放行'} / ${s.classification}`).join('；')}</p><p>{o.explanation}</p></section>)}
      <p><strong>对照：</strong>{r.comparison}</p><p><strong>选择依据：</strong>{r.reasoning}</p><p><strong>范围：</strong>{r.limitations}</p>
      {r.extension && <p><strong>选做上限4，不可行分析：</strong>{r.extension.basis}</p>}<p><strong>帮助：</strong>{r.assistance || '未记录'}</p>
    </div>;
  }
  const parsed = warehouseEvidenceSchema.safeParse(value); if (!parsed.success) return unavailable;
  const r = parsed.data;
  return <div className="space-y-4 whitespace-pre-wrap text-sm leading-7">
    <p><strong>模型：</strong>{r.model}</p>
    {r.observations.map((o) => <section key={o.runId} className="rounded border p-3"><p><strong>{o.condition} · D→{o.order.join('→')}→D</strong> · {o.runId}</p>
      <p>{o.runId === r.finalRunId && '基础最终方案'}{o.runId === r.transferRecheckId && '迁移：原顺序复核'}{o.runId === r.transferFinalId && '迁移：最终方案'}</p><p>预测：{o.prediction}</p>
      <p>总距离 {o.result.total}；办理 A={o.result.arrivals.A}，B={o.result.arrivals.B}，C={o.result.arrivals.C}；{o.result.urgent}≤{o.result.deadline}：{o.result.meets ? '满足' : '未满足'}。</p>
      <ul>{o.result.legs.map((leg, i) => <li key={i}>{leg.from}→{leg.to}：{leg.distance}，累计 {leg.end}；路径 {leg.nodes.map((p) => `(${p.x},${p.y})`).join('→')}</li>)}</ul><p>{o.explanation}</p></section>)}
    <p><strong>基础比较：</strong>{r.comparison}</p><p><strong>迁移说明：</strong>{r.transferReason}</p><p><strong>范围：</strong>{r.limitations}</p>
    {r.extension && <p><strong>选做 A≤3，不可行分析：</strong>{r.extension.basis}</p>}<p><strong>帮助：</strong>{r.assistance || '未记录'}</p>
  </div>;
}
