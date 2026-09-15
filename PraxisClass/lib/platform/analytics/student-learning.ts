import type { TestResultRow } from '@/lib/platform/db/types';

export interface LearningAttempt {
  id: string;
  taskKey: string;
  stageId: string;
  suite: string;
  createdAt: number;
  passed: number;
  total: number;
  cases: Array<{ id: string; passed: boolean }>;
}

/** Count complete submissions, keeping repeated cases and rehearsal out of achievements. */
export function buildStudentLearning(rows: TestResultRow[]) {
  const groups = new Map<string, TestResultRow[]>();
  for (const row of rows) {
    if (
      row.record_kind !== 'learning' ||
      !row.attempt_id ||
      !row.attempt_total ||
      row.suite === 'pbl_proficiency'
    )
      continue;
    const stageId = row.stage_id ?? row.course_id;
    const scene = row.scene_id ?? (row.suite.startsWith('pbl_') ? row.case_id : row.suite);
    const taskKey = JSON.stringify([stageId, row.course_version, row.suite, scene]);
    const key = JSON.stringify([row.learner_key, taskKey, row.attempt_id]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const attempts: LearningAttempt[] = [];
  let pendingAttempts = 0;
  for (const [id, group] of groups) {
    const ordered = [...group].sort((a, b) => a.created_at - b.created_at);
    const cases = [...new Map(ordered.map((row) => [row.case_id, row])).values()];
    const expected = Math.max(...group.map((row) => row.attempt_total ?? 0));
    if (cases.length !== expected) {
      pendingAttempts += 1;
      continue;
    }
    const row = ordered.at(-1)!;
    attempts.push({
      id,
      taskKey: (JSON.parse(id) as string[])[1],
      stageId: row.stage_id ?? row.course_id,
      suite: row.suite,
      createdAt: row.created_at,
      passed: cases.filter((item) => item.passed === 1).length,
      total: cases.length,
      cases: cases.map((item) => ({ id: item.case_id, passed: item.passed === 1 })),
    });
  }
  attempts.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const latest = [...new Map(attempts.map((attempt) => [attempt.taskKey, attempt])).values()];
  const correctedCases = latest.reduce(
    (sum, current) =>
      sum +
      current.cases.filter(
        (result) =>
          result.passed &&
          attempts.some(
            (previous) =>
              previous.taskKey === current.taskKey &&
              previous.id !== current.id &&
              previous.createdAt <= current.createdAt &&
              previous.cases.some((item) => item.id === result.id && !item.passed),
          ),
      ).length,
    0,
  );
  const activeDays = new Set(
    attempts.map((attempt) => new Date(attempt.createdAt).toISOString().slice(0, 10)),
  ).size;
  const total = latest.reduce((sum, attempt) => sum + attempt.total, 0);
  const passed = latest.reduce((sum, attempt) => sum + attempt.passed, 0);
  return {
    attemptCount: attempts.length,
    taskCount: latest.length,
    courseCount: new Set(attempts.map((attempt) => attempt.stageId)).size,
    activeDays,
    correctedCases,
    pendingAttempts,
    latestPassRate: total ? passed / total : null,
    achievements: [
      { id: 'first-practice', earned: attempts.length > 0 },
      { id: 'first-correction', earned: correctedCases > 0 },
      { id: 'three-days', earned: activeDays >= 3 },
    ],
    recentAttempts: attempts
      .slice(-20)
      .reverse()
      .map(({ cases: _cases, ...attempt }) => attempt),
  };
}

export type StudentLearningSummary = ReturnType<typeof buildStudentLearning>;
