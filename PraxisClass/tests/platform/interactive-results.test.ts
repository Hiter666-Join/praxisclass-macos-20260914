import { describe, expect, it } from 'vitest';
import { parseInteractiveResults } from '@/lib/platform/mirror/interactive-results';

const context = { stageId: 'host-stage', sceneId: 'host-scene', learnerKey: 'anon:host' };
const message = {
  type: 'praxis:code-test-results',
  version: 1,
  suite: 'case_a_algo',
  attemptId: 'run-1',
  results: [
    { caseId: 'empty', passed: true },
    { caseId: 'missing', passed: false, durationMs: 3 },
  ],
};
describe('interactive code result protocol', () => {
  it('uses host identity and actual per-case pass/fail', () => {
    const rows = parseInteractiveResults(
      { ...message, stageId: 'forged', learnerKey: 'forged' },
      context,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      stageId: 'host-stage',
      learnerKey: 'anon:host',
      passed: true,
      score: 1,
    });
    expect(rows[1]).toMatchObject({ score: 0, durationMs: 3, failureReason: 'wrong_answer' });
    expect(rows[0].attemptId).toBe(rows[1].attemptId);
  });
  it('rejects malformed, oversized, duplicate-case, and unknown-version batches', () => {
    for (const invalid of [
      null,
      {},
      { ...message, version: 2 },
      { ...message, results: [] },
      { ...message, results: [{ caseId: 'a', passed: 'true' }] },
      { ...message, results: Array(101).fill(message.results[0]) },
      { ...message, results: [message.results[0], message.results[0]] },
    ])
      expect(parseInteractiveResults(invalid, context)).toEqual([]);
  });
  it('keeps attempt identities separate between scenes', () => {
    expect(parseInteractiveResults(message, context)[0].attemptId).not.toBe(
      parseInteractiveResults(message, { ...context, sceneId: 'other-scene' })[0].attemptId,
    );
  });
});
