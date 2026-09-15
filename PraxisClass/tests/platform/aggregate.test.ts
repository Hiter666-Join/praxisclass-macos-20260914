import { describe, expect, it, vi } from 'vitest';

import { buildDashboardPayload } from '@/lib/platform/analytics/aggregate';
import type { FeedbackRow, TestResultRow } from '@/lib/platform/db/types';

function result(overrides: Partial<TestResultRow>): TestResultRow {
  return {
    id: 'result',
    suite: 'suite-a',
    case_id: 'case-a',
    learner_key: 'anon:learner-a',
    course_id: 'course-a',
    course_version: 'v1',
    dimension: null,
    passed: 1,
    score: 1,
    duration_ms: 10,
    failure_reason: null,
    idempotency_key: null,
    created_at: 1,
    ...overrides,
  };
}

function feedback(overrides: Partial<FeedbackRow>): FeedbackRow {
  return {
    id: 'feedback',
    form_type: 'teacher_prep',
    subject_id: 'teacher:main',
    course_id: 'course-a',
    course_version: 'v1',
    ratings_json: '{}',
    text_json: '{}',
    idempotency_key: null,
    created_at: 1,
    ...overrides,
  };
}

describe('buildDashboardPayload', () => {
  it('returns empty collections and null radar averages for empty input', () => {
    vi.setSystemTime(1234);
    const payload = buildDashboardPayload({
      scope: 'all',
      testResults: [],
      feedback: [],
      knowledge: { total: 0, withSource: 0 },
    });

    expect(payload.generatedAt).toBe(1234);
    expect(payload.overview).toEqual({
      learnerSessions: 0,
      feedbackCount: 0,
      testResultCount: 0,
      knowledge: { total: 0, withSource: 0 },
    });
    expect(payload.passRate).toEqual({ bySuite: [], byCourse: [], byCase: [], byLearner: [] });
    expect(payload.versionTrend).toEqual([]);
    expect(payload.quality.radar.every((item) => item.avg === null && item.n === 0)).toBe(true);
    expect(payload.quality.ratingDistribution).toEqual([]);
    expect(payload.quality.avgEditMinutesByVersion).toEqual([]);
    expect(payload.failures).toEqual({ topReasons: [], rows: [] });
    vi.useRealTimers();
  });

  it('calculates rates and version trends across two versions', () => {
    const tests = [
      result({ id: '1', course_version: 'v1', passed: 1 }),
      result({ id: '2', course_version: 'v1', passed: 0, failure_reason: 'wrong answer' }),
      result({ id: '3', course_version: 'v2', passed: 1 }),
      result({ id: '4', course_version: 'v2', passed: 1 }),
    ];
    const feedbackRows = [
      feedback({
        id: 'f1',
        course_version: 'v1',
        ratings_json: '{"generation_quality":3,"usability":5}',
        text_json: '{"edit_minutes":"20"}',
      }),
      feedback({
        id: 'f2',
        form_type: 'teacher_post_class',
        course_version: 'v2',
        ratings_json: '{"engagement_observed":5}',
        text_json: '{"edit_minutes":"10"}',
      }),
    ];
    const payload = buildDashboardPayload({
      scope: 'all',
      testResults: tests,
      feedback: feedbackRows,
      knowledge: { total: 2, withSource: 2 },
    });

    expect(payload.passRate.byCourse).toEqual([
      { key: 'course-a', passed: 3, total: 4, rate: 0.75 },
    ]);
    expect(payload.versionTrend).toEqual([
      {
        courseId: 'course-a',
        courseVersion: 'v1',
        passRate: 0.5,
        testTotal: 2,
        avgTeacherRating: 4,
        feedbackCount: 1,
      },
      {
        courseId: 'course-a',
        courseVersion: 'v2',
        passRate: 1,
        testTotal: 2,
        avgTeacherRating: 5,
        feedbackCount: 1,
      },
    ]);
    expect(payload.failures.topReasons).toEqual([{ reason: 'wrong answer', count: 1 }]);
  });

  it('sorts cases by ascending rate and keeps the lowest ten', () => {
    const tests = Array.from({ length: 12 }, (_, caseIndex) =>
      Array.from({ length: 12 }, (_, attempt) =>
        result({
          id: `${caseIndex}-${attempt}`,
          case_id: `case-${String(caseIndex).padStart(2, '0')}`,
          passed: attempt < caseIndex ? 1 : 0,
        }),
      ),
    ).flat();
    const payload = buildDashboardPayload({
      scope: 'self',
      testResults: tests,
      feedback: [],
      knowledge: { total: 0, withSource: 0 },
    });

    expect(payload.passRate.byCase).toHaveLength(10);
    expect(payload.passRate.byCase.map((row) => row.key)).toEqual(
      Array.from({ length: 10 }, (_, index) => `case-${String(index).padStart(2, '0')}`),
    );
  });
});
