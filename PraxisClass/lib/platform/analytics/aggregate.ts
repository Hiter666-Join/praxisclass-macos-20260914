import type { CourseLabelRow, FeedbackRow, TestResultRow } from '@/lib/platform/db/types';
import type { RecordKind } from '@/lib/platform/record-context';
import type { StudentLearningSummary } from './student-learning';

const RADAR_DIMENSIONS = [
  'generation_quality',
  'usability',
  'classroom_fit',
  'engagement_observed',
  'comprehension_observed',
] as const;

type RadarDimension = (typeof RADAR_DIMENSIONS)[number];

export type DashboardPayload = {
  recordKind?: RecordKind;
  recordCounts?: Record<RecordKind, number>;
  learning?: StudentLearningSummary;
  feedbackEntries?: FeedbackRow[];
  generatedAt: number;
  scope: 'all' | 'self';
  courseCatalog?: Array<Pick<CourseLabelRow, 'stage_id' | 'course_id' | 'course_version'>>;
  overview: {
    learnerSessions: number;
    feedbackCount: number;
    testResultCount: number;
    courseLabels?: number;
    knowledge: { total: number; withSource: number; synced: number };
  };
  passRate: {
    bySuite: Array<{ key: string; passed: number; total: number; rate: number }>;
    byCourse: Array<{ key: string; passed: number; total: number; rate: number }>;
    byCase: Array<{ key: string; passed: number; total: number; rate: number }>;
    byLearner: Array<{ key: string; passed: number; total: number; rate: number }>;
  };
  versionTrend: Array<{
    courseId: string;
    courseVersion: string;
    passRate: number | null;
    testTotal: number;
    avgTeacherRating: number | null;
    feedbackCount: number;
  }>;
  quality: {
    radar: Array<{ dimension: RadarDimension; avg: number | null; n: number }>;
    ratingDistribution: Array<{
      field: string;
      counts: [number, number, number, number, number];
    }>;
    avgEditMinutesByVersion: Array<{ courseVersion: string; avg: number | null; n: number }>;
  };
  failures: {
    topReasons: Array<{ reason: string; count: number }>;
    rows: Array<{
      suite: string;
      caseId: string;
      learnerKey: string;
      passed: boolean;
      durationMs: number | null;
      failureReason: string | null;
      createdAt: number;
    }>;
  };
};

function objectFromJson(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function groupPassRates(
  rows: TestResultRow[],
  keyOf: (row: TestResultRow) => string,
): Array<{ key: string; passed: number; total: number; rate: number }> {
  const groups = new Map<string, { passed: number; total: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key) ?? { passed: 0, total: 0 };
    group.total += 1;
    group.passed += row.passed === 1 ? 1 : 0;
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, value]) => ({ ...value, key, rate: value.total ? value.passed / value.total : 0 }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function numericRating(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : null;
}

export function buildDashboardPayload(input: {
  scope: 'all' | 'self';
  testResults: TestResultRow[];
  feedback: FeedbackRow[];
  knowledge: { total: number; withSource: number; synced?: number };
  courseLabels?: number;
  courseCatalog?: CourseLabelRow[];
}): DashboardPayload {
  const ratings = input.feedback.map((row) => ({ row, values: objectFromJson(row.ratings_json) }));
  const texts = input.feedback.map((row) => ({ row, values: objectFromJson(row.text_json) }));
  const byCase = groupPassRates(input.testResults, (row) => row.case_id)
    .sort((left, right) => left.rate - right.rate || left.key.localeCompare(right.key))
    .slice(0, 10);

  const trendKeys = new Set<string>();
  for (const row of input.testResults) trendKeys.add(`${row.course_id}\u0000${row.course_version}`);
  for (const row of input.feedback) trendKeys.add(`${row.course_id}\u0000${row.course_version}`);
  const versionTrend = [...trendKeys]
    .map((key) => {
      const [courseId, courseVersion] = key.split('\u0000');
      const tests = input.testResults.filter(
        (row) => row.course_id === courseId && row.course_version === courseVersion,
      );
      const feedback = ratings.filter(
        ({ row }) => row.course_id === courseId && row.course_version === courseVersion,
      );
      const teacherRatings = feedback
        .filter(
          ({ row }) => row.form_type === 'teacher_prep' || row.form_type === 'teacher_post_class',
        )
        .flatMap(({ values }) =>
          Object.values(values)
            .map(numericRating)
            .filter((value) => value !== null),
        );
      return {
        courseId,
        courseVersion,
        passRate: tests.length
          ? tests.filter((row) => row.passed === 1).length / tests.length
          : null,
        testTotal: tests.length,
        avgTeacherRating: mean(teacherRatings),
        feedbackCount: feedback.length,
      };
    })
    .sort(
      (left, right) =>
        left.courseId.localeCompare(right.courseId) ||
        left.courseVersion.localeCompare(right.courseVersion),
    );

  const radar = RADAR_DIMENSIONS.map((dimension) => {
    const values = ratings
      .filter(
        ({ row }) => row.form_type === 'teacher_prep' || row.form_type === 'teacher_post_class',
      )
      .map(({ values: record }) => numericRating(record[dimension]))
      .filter((value) => value !== null);
    return { dimension, avg: mean(values), n: values.length };
  });

  const distribution = new Map<string, [number, number, number, number, number]>();
  for (const { values } of ratings) {
    for (const [field, raw] of Object.entries(values)) {
      const value = numericRating(raw);
      if (value === null) continue;
      const counts = distribution.get(field) ?? [0, 0, 0, 0, 0];
      counts[value - 1] += 1;
      distribution.set(field, counts);
    }
  }

  const editMinutes = new Map<string, number[]>();
  for (const { row, values } of texts) {
    if (row.form_type !== 'teacher_prep') continue;
    const raw = values.edit_minutes;
    const value =
      typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
    if (!Number.isFinite(value) || value < 0) continue;
    const bucket = editMinutes.get(row.course_version) ?? [];
    bucket.push(value);
    editMinutes.set(row.course_version, bucket);
  }

  const reasonCounts = new Map<string, number>();
  for (const row of input.testResults) {
    const reason = row.failure_reason?.trim();
    if (row.passed === 0 && reason) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  const sortedRows = [...input.testResults].sort(
    (left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id),
  );

  return {
    generatedAt: Date.now(),
    scope: input.scope,
    ...(input.courseCatalog
      ? {
          courseCatalog: input.courseCatalog.map(({ stage_id, course_id, course_version }) => ({
            stage_id,
            course_id,
            course_version,
          })),
        }
      : {}),
    overview: {
      learnerSessions: new Set(input.testResults.map((row) => row.learner_key)).size,
      feedbackCount: input.feedback.length,
      testResultCount: input.testResults.length,
      ...(input.courseLabels === undefined ? {} : { courseLabels: input.courseLabels }),
      knowledge: {
        total: input.knowledge.total,
        withSource: input.knowledge.withSource,
        ...(input.knowledge.synced === undefined ? {} : { synced: input.knowledge.synced }),
      } as DashboardPayload['overview']['knowledge'],
    },
    passRate: {
      bySuite: groupPassRates(input.testResults, (row) => row.suite),
      byCourse: groupPassRates(input.testResults, (row) => row.course_id),
      byCase,
      byLearner: groupPassRates(input.testResults, (row) => row.learner_key),
    },
    versionTrend,
    quality: {
      radar,
      ratingDistribution: [...distribution.entries()]
        .map(([field, counts]) => ({ field, counts }))
        .sort((left, right) => left.field.localeCompare(right.field)),
      avgEditMinutesByVersion: [...editMinutes.entries()]
        .map(([courseVersion, values]) => ({ courseVersion, avg: mean(values), n: values.length }))
        .sort((left, right) => left.courseVersion.localeCompare(right.courseVersion)),
    },
    failures: {
      topReasons: [...reasonCounts.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))
        .slice(0, 5),
      rows: (input.scope === 'all' ? sortedRows.slice(0, 200) : sortedRows).map((row) => ({
        suite: row.suite,
        caseId: row.case_id,
        learnerKey: row.learner_key,
        passed: row.passed === 1,
        durationMs: row.duration_ms,
        failureReason: row.failure_reason,
        createdAt: row.created_at,
      })),
    },
  };
}
