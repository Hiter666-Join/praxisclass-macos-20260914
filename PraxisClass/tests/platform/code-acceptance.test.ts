import { describe, expect, it } from 'vitest';
import { codeEvidenceSchema, codeFunctionalResult, contractExpected, diagnosticInputSchema, type CodeEvidence } from '@/lib/training/code-acceptance';

const testPlan = [{ id: 'D2', nums: [1, 3, 3, 5, 8], target: 3, expected: 1, reason: '检查首次位置，排除找到任意匹配就返回。' }];
function evidence(): CodeEvidence {
  return {
    version: 'AI-CODE-1.0', contractUnderstanding: '首次位置，零基下标，缺失返回整数-1。',
    codeSource: '定向测试构造，不是实际学生运行', code: 'def solution(nums, target):\n    return -1', codeRevision: 1,
    changeReason: '测试数据，不宣称实际运行', assistance: '', testPlan: structuredClone(testPlan), diagnostic: null,
    run: { runId: '00000000-0000-4000-8000-000000000001', purpose: 'acceptance', suiteVersion: 'A-20260905-01', code: 'def solution(nums, target):\n    return -1', codeRevision: 1, testPlan: structuredClone(testPlan), startedAt: '2026-09-14T00:00:00.000Z', completedAt: '2026-09-14T00:00:01.000Z', environment: 'unit fixture', status: 'completed', error: '', results: Array.from({ length: 12 }, (_, i) => ({ caseId: `fixture-${i}`, passed: i !== 0, state: 'returned', durationMs: 0, ...(i === 0 ? { failureReason: 'wrong_answer' as const } : {}) })) },
    conclusion: 'reject', reasoning: '存在返回值不符合契约的实际行。', limitations: '本夹具仅检查记录绑定。',
  };
}
describe('code acceptance snapshot and execution boundaries', () => {
  it('keeps functional failure separate from an evidence-based rejection', () => {
    const record = codeEvidenceSchema.parse(evidence());
    expect(record.conclusion).toBe('reject');
    expect(codeFunctionalResult(record).status).toBe('failed');
  });
  it('rejects old execution for modified code, revision or test plan', () => {
    for (const modify of [(r: CodeEvidence) => { r.code += '\n# change'; }, (r: CodeEvidence) => { r.codeRevision++; }, (r: CodeEvidence) => { r.testPlan[0].expected = 2; }]) {
      const record = evidence(); modify(record);
      expect(codeEvidenceSchema.safeParse(record).success).toBe(false);
    }
  });
  it('does not accept public diagnostics as the fixed suite', () => {
    const record = evidence(); record.run.purpose = 'diagnostic'; record.run.suiteVersion = 'CODE-DIAG-1.0';
    expect(codeEvidenceSchema.safeParse(record).success).toBe(false);
  });
  it('represents failed initialization with no fabricated case rows', () => {
    const record = evidence(); record.run.status = 'environment_unavailable'; record.run.results = []; record.conclusion = 'unknown';
    expect(codeEvidenceSchema.safeParse(record).success).toBe(true);
    expect(codeFunctionalResult(record).status).toBe('unknown');
    record.run.results = evidence().run.results;
    expect(codeEvidenceSchema.safeParse(record).success).toBe(false);
  });
  it('preserves actually completed rows on timeout and requires an incomplete conclusion', () => {
    const record = evidence(); record.run.status = 'timeout'; record.run.results = record.run.results.slice(0, 2); record.conclusion = 'unknown';
    expect(codeEvidenceSchema.safeParse(record).success).toBe(true);
    record.conclusion = 'accept';
    expect(codeEvidenceSchema.safeParse(record).success).toBe(false);
  });
  it('rejects duplicate fixed results and new hidden return content', () => {
    const record = evidence(); record.run.results[1].caseId = record.run.results[0].caseId;
    expect(codeEvidenceSchema.safeParse(record).success).toBe(false);
    const expanded = evidence(); expanded.run.results[0].actualRepr = 'do not include hidden returns';
    expect(codeEvidenceSchema.safeParse(expanded).success).toBe(false);
  });
  it('checks public diagnostic inputs without eval or boolean coercion', () => {
    for (const nums of [[true], [3, 1], [1.2], ['1'], Array(65).fill(1)]) expect(diagnosticInputSchema.safeParse({ ...testPlan[0], nums }).success).toBe(false);
    expect(contractExpected([1, 3, 3, 5, 8], 3)).toBe(1);
    expect(contractExpected([], 3)).toBe(-1);
    expect(contractExpected([3], 3)).toBe(0);
  });
});
