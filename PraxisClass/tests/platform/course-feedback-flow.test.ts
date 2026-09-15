import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST as feedback } from '@/app/api/platform/feedback/route';
import { POST as testResult } from '@/app/api/platform/test-result/route';
import { GET as dashboard } from '@/app/api/platform/dashboard/route';
import { getPlatformDao, resetPlatformDaoForTests } from '@/lib/platform/db/dao';
import type { DashboardPayload } from '@/lib/platform/analytics/aggregate';
import { matchCourseStats } from '@/components/platform/course-card';

let directory = '';
const post = (route: string, body: unknown) =>
  new Request(`http://localhost/api/platform/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(body as Record<string, unknown>), record_kind: 'learning' }),
  });

describe.each(['sqlite', 'jsonl'] as const)('%s course feedback flow', (driver) => {
  beforeEach(() => {
    resetPlatformDaoForTests();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-course-flow-'));
    process.env.PLATFORM_DATA_DIR = directory;
    process.env.PLATFORM_DB_DRIVER = driver;
    delete process.env.TEACHER_PIN;
  });
  afterEach(() => {
    resetPlatformDaoForTests();
    fs.rmSync(directory, { recursive: true, force: true });
    delete process.env.PLATFORM_DATA_DIR;
    delete process.env.PLATFORM_DB_DRIVER;
  });

  it('keeps prep, quiz, learner and post-class feedback in the same course/version', async () => {
    for (const version of ['v1', 'v2']) {
      const stage = `stage-${version}`;
      expect(
        (
          await feedback(
            post('feedback', {
              form_type: 'teacher_prep',
              subject_id: 'teacher:main',
              course_id: 'python-search',
              course_version: version,
              stage_id: stage,
              ratings: { usability: 4 },
              text: {},
            }),
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await testResult(
            post('test-result', {
              suite: 'quiz',
              case_id: 'boundary',
              learner_key: 'anon:learner-a',
              stage_id: stage,
              attempt_id: 'one',
              passed: version === 'v2',
              score: version === 'v2' ? 1 : 0,
            }),
          )
        ).status,
      ).toBe(201);
    }
    for (const form of ['learner_session', 'teacher_post_class']) {
      expect(
        (
          await feedback(
            post('feedback', {
              form_type: form,
              subject_id: form === 'learner_session' ? 'anon:learner-a' : 'teacher:main',
              course_id: 'stage-v2',
              stage_id: 'stage-v2',
              ratings: { understanding: 4 },
              text: {},
            }),
          )
        ).status,
      ).toBe(201);
    }
    const response = await dashboard(
      new Request('http://localhost/api/platform/dashboard?scope=all'),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as DashboardPayload;
    expect(
      payload.versionTrend.map((row) => [row.courseId, row.courseVersion, row.feedbackCount]),
    ).toEqual([
      ['python-search', 'v1', 1],
      ['python-search', 'v2', 3],
    ]);
    expect(matchCourseStats(payload, 'stage-v1')).toEqual({
      version: 'v1',
      passRate: 0,
      attempts: 1,
      feedbackCount: 1,
    });
    expect(matchCourseStats(payload, 'stage-v2')).toEqual({
      version: 'v2',
      passRate: 1,
      attempts: 1,
      feedbackCount: 3,
    });

    const self = await dashboard(
      new Request('http://localhost/api/platform/dashboard?scope=self', {
        headers: { 'x-learner-key': 'anon:learner-b' },
      }),
    );
    const own = (await self.json()) as DashboardPayload;
    expect(own.overview.testResultCount).toBe(0);
    expect(own.overview.feedbackCount).toBe(0);
  });

  it('deduplicates a retry without dropping the same case id in another suite', async () => {
    const base = {
      case_id: 'one',
      stage_id: 'stage',
      learner_key: 'anon:learner-a',
      attempt_id: 'one',
      passed: true,
      score: 1,
    };
    for (const suite of ['quiz', 'case_a_algo']) {
      const first = await (await testResult(post('test-result', { ...base, suite }))).json();
      const retry = await (await testResult(post('test-result', { ...base, suite }))).json();
      expect(first.duplicate).toBe(false);
      expect(retry).toEqual({ id: first.id, duplicate: true });
    }
    expect((await getPlatformDao()).listTestResults()).toHaveLength(2);
  });
});
