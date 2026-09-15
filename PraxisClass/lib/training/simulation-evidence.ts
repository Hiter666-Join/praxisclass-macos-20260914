import { z } from 'zod';
import { canonical } from '@/lib/platform/training/contracts';
import { retrySimulation, visionSimulation, routeSimulation } from './simulation-engine';

const text = z.string().trim().min(1).max(8000);
const short = z.string().max(8000);
const revision = z.number().int().positive();
const result = <T>() => z.custom<T>((v) => !!v && typeof v === 'object' && !Array.isArray(v));
const agrees = (a: unknown, b: unknown) => canonical(a) === canonical(b);
export const retryDesignSchema = z.object({ mode: z.enum(['plain', 'dedupe']), retryKey: z.enum(['same', 'new']), newKey: z.enum(['same', 'new']) }).strict();
export const retryRoundSchema = z.object({
  runId: z.uuid(), designRevision: revision, scenario: z.enum(['V1', 'V2', 'V3']), design: retryDesignSchema,
  followups: z.number().int().min(1).max(4), conflict: z.boolean(), revealed: z.literal(true),
  judgment: z.object({ conclusion: text, reason: text, observed: z.boolean(), assisted: z.boolean() }).strict(),
  prediction: z.object({ total: z.number().int().min(0).max(6), reason: text }).strict(),
  explanation: text, result: result<ReturnType<typeof retrySimulation>>(),
}).strict().superRefine((r, ctx) => {
  if (!agrees(r.result, retrySimulation(r.scenario, r.design, r.followups, r.conflict))) ctx.addIssue({ code: 'custom', message: '重试记录与本轮规则计算不对应。', path: ['result'] });
});
export const retryEvidenceSchema = z.object({
  version: z.literal('RETRY-TICKET-1.0'), designRevision: revision, design: retryDesignSchema,
  rulesReason: text, rounds: z.array(retryRoundSchema).max(20), conclusion: text, limitations: text, assistance: short,
}).strict().superRefine((r, ctx) => {
  if (new Set(r.rounds.map((v) => v.runId)).size !== r.rounds.length) ctx.addIssue({ code: 'custom', message: '轮次编号重复。' });
  if (r.rounds.some((v) => v.designRevision !== r.designRevision || !agrees(v.design, r.design))) ctx.addIssue({ code: 'custom', message: '三类验证必须属于同一最终方案版本。' });
});

export const visionObservationSchema = z.object({
  runId: z.uuid(), threshold: z.number().int().min(0).max(100), condition: z.enum(['BASIC', 'EXTENSION']),
  prediction: text, explanation: text, result: result<ReturnType<typeof visionSimulation>>(),
}).strict().superRefine((r, ctx) => {
  if (!agrees(r.result, visionSimulation(r.threshold, r.condition))) ctx.addIssue({ code: 'custom', message: '图卡分组、计数或版本与当前阈值不对应。', path: ['result'] });
});
export const visionEvidenceSchema = z.object({
  version: z.literal('VISION-QC-1.1'), observations: z.array(visionObservationSchema).max(30), finalRunId: short,
  comparison: text, reasoning: text, limitations: text, assistance: short,
  extension: z.object({ condition: z.literal('EXTENSION'), conditionVersion: z.literal(1), conclusion: z.literal('infeasible'), basis: text }).strict().nullable(),
}).strict().superRefine((r, ctx) => {
  if (new Set(r.observations.map((v) => v.runId)).size !== r.observations.length) ctx.addIssue({ code: 'custom', message: '观察编号重复。' });
  if (r.finalRunId && !r.observations.some((v) => v.runId === r.finalRunId && v.condition === 'BASIC')) ctx.addIssue({ code: 'custom', message: '最终选择须引用本人已记录的基础条件计算。' });
});

export const routeObservationSchema = z.object({
  runId: z.uuid(), order: z.array(z.enum(['A', 'B', 'C'])).length(3).refine((v) => new Set(v).size === 3, 'A/B/C 须各一次。'),
  condition: z.enum(['BASIC', 'TRANSFER', 'EXTENSION']), prediction: text, explanation: text,
  result: result<ReturnType<typeof routeSimulation>>(),
}).strict().superRefine((r, ctx) => {
  if (new Set(r.order).size === 3 && !agrees(r.result, routeSimulation(r.order, r.condition))) ctx.addIssue({ code: 'custom', message: '路线、途经、办理时刻或条件版本与实际计算不对应。', path: ['result'] });
});
export const warehouseEvidenceSchema = z.object({
  version: z.literal('WAREHOUSE-ROUTE-1.0'), model: text, observations: z.array(routeObservationSchema).max(30),
  finalRunId: short, transferRecheckId: short, transferFinalId: short, comparison: text, transferReason: text, limitations: text, assistance: short,
  extension: z.object({ condition: z.literal('EXTENSION'), conditionVersion: z.literal(1), conclusion: z.literal('infeasible'), basis: text }).strict().nullable(),
}).strict().superRefine((r, ctx) => {
  if (new Set(r.observations.map((v) => v.runId)).size !== r.observations.length) ctx.addIssue({ code: 'custom', message: '路线计算编号重复。' });
  for (const [key, condition] of [['finalRunId', 'BASIC'], ['transferRecheckId', 'TRANSFER'], ['transferFinalId', 'TRANSFER']] as const) {
    if (r[key] && !r.observations.some((v) => v.runId === r[key] && v.condition === condition)) ctx.addIssue({ code: 'custom', path: [key], message: '请选择对应条件下本人已记录的计算。' });
  }
  const base = r.observations.find((v) => v.runId === r.finalRunId), recheck = r.observations.find((v) => v.runId === r.transferRecheckId);
  if (base && recheck && !agrees(base.order, recheck.order)) ctx.addIssue({ code: 'custom', message: '迁移复核须使用基础最终方案的同一顺序。' });
});

export const simulationSchemas = { retry: retryEvidenceSchema, vision: visionEvidenceSchema, warehouse: warehouseEvidenceSchema } as const;
export type SimulationCase = keyof typeof simulationSchemas;
export const simulationParts = { retry: '重试设计说明', vision: '筛查规则建议单', warehouse: '路线设计与验证说明' } as const;
export function isSimulationCase(value: string | undefined): value is SimulationCase { return value === 'retry' || value === 'vision' || value === 'warehouse'; }
export function simulationRule(caseId: SimulationCase, value: unknown): { status: 'passed' | 'failed' | 'unknown'; basis: string } {
  let complete: boolean, passed: boolean, basis: string;
  if (caseId === 'retry') {
    const r = retryEvidenceSchema.parse(value);
    complete = ['V1', 'V2', 'V3'].every((s) => r.rounds.some((v) => v.scenario === s && !v.conflict));
    passed = r.design.mode === 'dedupe' && r.design.retryKey === 'same' && r.design.newKey === 'new';
    basis = r.rounds.filter((v) => !v.conflict).map((v) => `${v.scenario}：${v.result.total}张，收到[${v.result.client.received.join(', ')}]`).join('；');
    basis += '。数量与标识意图分别检查；V1换标识即使只有1张，也不构成可靠重试策略。';
  } else if (caseId === 'vision') {
    const r = visionEvidenceSchema.parse(value), base = r.observations.filter((v) => v.condition === 'BASIC');
    complete = new Set(base.map((v) => v.result.groupKey)).size >= 2 && !!r.finalRunId;
    const selected = base.find((v) => v.runId === r.finalRunId);
    passed = !!selected?.result.meets;
    basis = selected ? `最终阈值${selected.threshold}：漏检${selected.result.FN}，复检${selected.result.review}/5。分组不同的基础观察${new Set(base.map((v) => v.result.groupKey)).size}组。` : '尚无最终基础规则的本人计算记录。';
  } else {
    const r = warehouseEvidenceSchema.parse(value), base = r.observations.filter((v) => v.condition === 'BASIC');
    const selected = base.find((v) => v.runId === r.finalRunId), transfer = r.observations.find((v) => v.runId === r.transferFinalId);
    complete = new Set(base.map((v) => v.order.join(''))).size >= 2 && !!selected && !!r.transferRecheckId && !!transfer;
    passed = !!selected?.result.meets && !!transfer?.result.meets;
    basis = `基础${selected ? `A=${selected.result.arrivals.A}≤4，距离${selected.result.total}` : '尚未选择'}；迁移${transfer ? `B=${transfer.result.arrivals.B}≤1，距离${transfer.result.total}` : '尚未选择'}。迁移取消A期限，较长但按时的方案仍可行。`;
  }
  return { status: !complete ? 'unknown' : passed ? 'passed' : 'failed', basis: (!complete ? '必要记录尚未完整，保留未完成状态。' : '') + basis };
}

/** Student help cannot receive unrevealed scenario truth, including via a crafted currentInput. */
export function retryVisibleInput(value: unknown): unknown {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const fields = raw.fields && typeof raw.fields === 'object' ? raw.fields as Record<string, unknown> : {};
  const current = raw.current as Record<string, unknown> | undefined;
  const visibleRound = (r: Record<string, unknown>) => {
    const design = retryDesignSchema.safeParse(r.design);
    const scenario = z.enum(['V1', 'V2', 'V3']).safeParse(r.scenario);
    const followups = z.number().int().min(0).max(4).safeParse(r.followups);
    if (!design.success || !scenario.success || !followups.success) return { status: '尚无可核对的当前轮次' };
    const actual = retrySimulation(scenario.data, design.data, followups.data, r.conflict === true);
    return { design: design.data, judgment: r.judgment ?? null, prediction: r.prediction ?? null, explanation: typeof r.explanation === 'string' ? r.explanation : '', client: actual.client, ...(r.revealed === true ? { observed: true, teachingPanorama: actual } : { observed: false, status: '尚未展开教学观察；不能据情形编号确定故障位置' }) };
  };
  return { rulesReason: raw.rulesReason ?? '', conclusion: raw.conclusion ?? '', limitations: raw.limitations ?? '', assistance: raw.assistance ?? '',
    unsavedFields: Object.fromEntries(['judgment', 'judgment-reason', 'prediction', 'prediction-reason'].map((key) => [key, typeof fields[key] === 'string' ? fields[key] : ''])),
    current: current ? visibleRound(current) : null,
    rounds: Array.isArray(raw.rounds) ? raw.rounds.filter((r) => r && typeof r === 'object').slice(-20).map((r) => visibleRound(r as Record<string, unknown>)) : [],
  };
}
