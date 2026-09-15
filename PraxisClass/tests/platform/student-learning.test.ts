import { describe, expect, it } from 'vitest';
import { buildStudentLearning } from '@/lib/platform/analytics/student-learning';
import type { TestResultRow } from '@/lib/platform/db/types';

function row(
  attempt: string,
  caseId: string,
  passed: boolean,
  time: number,
  extra: Partial<TestResultRow> = {},
): TestResultRow {
  return {
    id: `${attempt}-${caseId}`,
    suite: 'code',
    learner_key: 'anon:a',
    course_id: 'course',
    course_version: 'v1',
    stage_id: 'stage',
    scene_id: 'scene',
    attempt_id: attempt,
    attempt_total: 2,
    record_kind: 'learning',
    case_id: caseId,
    passed: passed ? 1 : 0,
    score: passed ? 1 : 0,
    created_at: time,
    dimension: null,
    duration_ms: null,
    failure_reason: null,
    idempotency_key: null,
    ...extra,
  };
}

describe('personal learning metrics', () => {
  it('counts complete attempts and latest outcomes, without losing correction history', () => {
    const rows = [
      row('a', '1', true, 1),
      row('a', '2', false, 2),
      row('b', '1', true, 3),
      row('b', '2', true, 4),
      row('c', '1', true, 5),
      row('c', '2', true, 6),
    ];
    const result = buildStudentLearning(rows);
    expect(result).toMatchObject({
      attemptCount: 3,
      taskCount: 1,
      courseCount: 1,
      correctedCases: 1,
      latestPassRate: 1,
    });
    expect(result.achievements.filter((item) => item.earned)).toHaveLength(2);
  });
  it('excludes demo, unclassified, proficiency observations and partial batches from achievements', () => {
    const rows = [
      row('demo', '1', true, 1, { record_kind: 'demo', attempt_total: 1 }),
      row('old', '1', true, 2, { record_kind: 'legacy', attempt_total: 1 }),
      row('partial', '1', true, 3),
      row('signal', '1', true, 4, { suite: 'pbl_proficiency', attempt_total: 1 }),
    ];
    expect(buildStudentLearning(rows)).toMatchObject({
      attemptCount: 0,
      correctedCases: 0,
      pendingAttempts: 1,
      latestPassRate: null,
    });
    expect(buildStudentLearning(rows).achievements.some((item) => item.earned)).toBe(false);
  });
  it('does not merge two scenes that use the same case ids', () => {
    const rows = [
      row('a', '1', false, 1, { attempt_total: 1 }),
      row('b', '1', true, 2, { scene_id: 'other', attempt_total: 1 }),
    ];
    expect(buildStudentLearning(rows)).toMatchObject({
      taskCount: 2,
      correctedCases: 0,
      latestPassRate: 0.5,
    });
  });
});
