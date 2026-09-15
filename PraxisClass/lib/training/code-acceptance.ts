import { z } from 'zod';
import { canonical } from '@/lib/platform/training/contracts';

const integer = z.number().int().min(-1_000_000).max(1_000_000);
export const diagnosticInputSchema = z.object({
  id: z.string().min(1).max(80),
  nums: z.array(integer).max(64).refine((nums) => nums.every((n, i) => i === 0 || nums[i - 1] <= n), '输入必须非递减排序'),
  target: integer,
  expected: integer,
  reason: z.string().min(1).max(2000),
}).strict();
export const codeResultSchema = z.object({
  caseId: z.string().min(1).max(80),
  passed: z.boolean(),
  durationMs: z.number().int().nonnegative().max(300000),
  state: z.enum(['returned', 'exception']),
  failureReason: z.enum(['wrong_answer', 'runtime_error']).optional(),
  actualType: z.string().max(80).optional(),
  actualRepr: z.string().max(300).optional(),
  actualInt: z.number().int().optional(),
}).strict();
export const codeRunSchema = z.object({
  runId: z.uuid(),
  retryOf: z.uuid().optional(),
  purpose: z.enum(['diagnostic', 'acceptance']),
  suiteVersion: z.enum(['CODE-DIAG-1.0', 'A-20260905-01']),
  code: z.string().min(1).max(20000),
  codeRevision: z.number().int().positive(),
  testPlan: z.array(diagnosticInputSchema).min(1).max(16),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  environment: z.string().max(300),
  status: z.enum(['completed', 'source_error', 'timeout', 'environment_unavailable', 'execution_error']),
  error: z.string().max(600),
  results: z.array(codeResultSchema).max(16),
}).strict();
export const codeEvidenceSchema = z.object({
  version: z.literal('AI-CODE-1.0'),
  contractUnderstanding: z.string().min(1).max(4000),
  codeSource: z.string().min(1).max(600),
  code: z.string().min(1).max(20000),
  codeRevision: z.number().int().positive(),
  changeReason: z.string().min(1).max(2000),
  assistance: z.string().max(2000),
  testPlan: z.array(diagnosticInputSchema).min(1).max(16),
  diagnostic: codeRunSchema.nullable(),
  run: codeRunSchema,
  conclusion: z.enum(['accept', 'reject', 'unknown']),
  reasoning: z.string().min(1).max(4000),
  limitations: z.string().min(1).max(2000),
}).strict().superRefine((record, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  const run = record.run;
  if (run.purpose !== 'acceptance' || run.suiteVersion !== 'A-20260905-01') fail('正式成果必须引用固定验收运行，不能用公开试跑代替。');
  if (run.code !== record.code || run.codeRevision !== record.codeRevision || canonical(run.testPlan) !== canonical(record.testPlan)) fail('代码或测试计划已经修改，请重新运行验收。');
  if (new Set(run.results.map((r) => r.caseId)).size !== run.results.length) fail('运行结果编号重复。');
  if (run.status === 'completed' && run.results.length !== 12) fail('固定套件尚未完整执行12例。');
  if (['source_error', 'environment_unavailable'].includes(run.status) && run.results.length) fail('尚未执行的用例不能生成失败行。');
  if (run.results.length > 12 || run.results.some((r) => r.passed && (r.state !== 'returned' || r.failureReason !== undefined))) fail('固定运行的状态与实际完成行不一致。');
  if (run.results.some((r) => r.actualType !== undefined || r.actualRepr !== undefined || r.actualInt !== undefined)) fail('固定运行不新增隐藏用例返回内容。');
  if (run.status !== 'completed' && record.conclusion !== 'unknown') fail('固定验收未完成，请保留尚不能判断及故障说明。');
  if (record.diagnostic) {
    const diagnostic = record.diagnostic;
    if (diagnostic.purpose !== 'diagnostic' || diagnostic.suiteVersion !== 'CODE-DIAG-1.0') fail('公开诊断与固定套件不能混用。');
    if (diagnostic.results.some((r) => !diagnostic.testPlan.some((p) => p.id === r.caseId))) fail('诊断结果与当次输入不对应。');
    if (diagnostic.status === 'completed' && diagnostic.results.length !== diagnostic.testPlan.length) fail('公开诊断尚未完整执行。');
  }
});
export type CodeEvidence = z.infer<typeof codeEvidenceSchema>;
export type CodeRun = z.infer<typeof codeRunSchema>;

export function contractExpected(nums: readonly number[], target: number): number {
  return nums.findIndex((number) => number === target);
}

export function codeFunctionalResult(record: CodeEvidence) {
  if (record.run.status !== 'completed') return { status: 'unknown' as const, basis: '固定验收未完整结束；已执行部分和故障状态保留，不补造未执行用例。' };
  const passed = record.run.results.filter((row) => row.passed).length;
  return {
    status: passed === 12 ? 'passed' as const : 'failed' as const,
    basis: `当次代码在 A-20260905-01 完成 ${passed}/12 项。此项仅表示返回值功能核对，不代替契约理解、测试设计或验收判断，也不证明复杂度。`,
  };
}
