import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getPlatformDao, resetPlatformDaoForTests } from '@/lib/platform/db/dao';

let testDirectory = '';

afterEach(() => {
  resetPlatformDaoForTests();
  if (testDirectory) fs.rmSync(testDirectory, { recursive: true, force: true });
  delete process.env.PLATFORM_DATA_DIR;
  delete process.env.PLATFORM_DB_DRIVER;
});

describe.each(['sqlite', 'jsonl'] as const)('%s platform DAO', (driver) => {
  beforeEach(() => {
    resetPlatformDaoForTests();
    testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), `praxis-platform-${driver}-`));
    process.env.PLATFORM_DATA_DIR = testDirectory;
    process.env.PLATFORM_DB_DRIVER = driver;
  });

  it('inserts, lists, and counts records', async () => {
    const dao = await getPlatformDao();
    dao.insertMemoryEvent({
      scope: 'learner',
      subject_id: 'anon:learner-1',
      session_id: 'session-1',
      event_type: 'task_completed',
      payload_json: '{}',
    });
    dao.insertFeedback({
      form_type: 'learner_session',
      subject_id: 'anon:learner-1',
      course_id: 'course-1',
      course_version: 'v1',
      ratings_json: '{"understanding":4}',
      text_json: '{}',
    });
    dao.insertTestResult({
      suite: 'quiz',
      case_id: 'case-1',
      learner_key: 'anon:learner-1',
      course_id: 'course-1',
      course_version: 'v1',
      dimension: null,
      passed: true,
      score: 1,
      duration_ms: 20,
      failure_reason: null,
    });

    expect(dao.listMemoryEvents({ scope: 'learner', subjectId: 'anon:learner-1' })).toHaveLength(1);
    expect(dao.listFeedback({ subjectId: 'anon:learner-1' })).toHaveLength(1);
    expect(dao.countFeedback({ subjectId: 'anon:learner-1' })).toBe(1);
    expect(dao.listTestResults({ courseId: 'course-1' })).toHaveLength(1);
    expect(dao.countTestResults()).toBe(1);
    expect(dao.countDistinctLearners()).toBe(1);
  });

  it('deduplicates idempotent feedback and test results', async () => {
    const dao = await getPlatformDao();
    const feedback = {
      form_type: 'teacher_prep' as const,
      subject_id: 'teacher:main',
      course_id: 'course-1',
      course_version: 'v1',
      ratings_json: '{"usability":5}',
      text_json: '{}',
      idempotency_key: 'feedback-key',
    };
    const result = {
      suite: 'quiz',
      case_id: 'case-1',
      learner_key: 'anon:learner-1',
      course_id: 'course-1',
      course_version: 'v1',
      dimension: null,
      passed: true,
      score: 1,
      duration_ms: null,
      failure_reason: null,
      idempotency_key: 'result-key',
    };

    expect(dao.insertFeedback(feedback).duplicate).toBe(false);
    expect(dao.insertFeedback(feedback).duplicate).toBe(true);
    expect(dao.insertTestResult(result).duplicate).toBe(false);
    expect(dao.insertTestResult(result).duplicate).toBe(true);
    expect(dao.countFeedback()).toBe(1);
    expect(dao.countTestResults()).toBe(1);
  });

  it('searches knowledge by a case-insensitive name or content substring', async () => {
    const dao = await getPlatformDao();
    dao.bulkInsertKnowledge([
      { name: 'Binary Search', content: 'Divide a sorted range', source: 'Source A', stage: null },
      { name: 'Loops', content: 'Iteration basics', source: 'Source B', stage: null },
    ]);

    expect(dao.listKnowledge({ q: 'binary' }).map((row) => row.name)).toEqual(['Binary Search']);
    expect(dao.listKnowledge({ q: 'ITERATION' }).map((row) => row.name)).toEqual(['Loops']);
    expect(dao.countKnowledge()).toEqual({ total: 2, withSource: 2 });
  });
});

describe('jsonl read reliability', () => {
  it('skips and counts a malformed line', async () => {
    testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-platform-jsonl-corrupt-'));
    process.env.PLATFORM_DATA_DIR = testDirectory;
    process.env.PLATFORM_DB_DRIVER = 'jsonl';
    resetPlatformDaoForTests();
    const dao = await getPlatformDao();
    dao.insertFeedback({
      form_type: 'learner_session',
      subject_id: 'anon:learner-1',
      course_id: 'course-1',
      course_version: 'v1',
      ratings_json: '{}',
      text_json: '{}',
    });
    fs.appendFileSync(path.join(testDirectory, 'platform', 'feedback_records.jsonl'), '{broken\n');

    expect(dao.listFeedback()).toHaveLength(1);
    expect(dao.getReadStats()).toEqual({ skippedLines: 1 });
    expect(dao.listFeedback()).toHaveLength(1);
    expect(dao.getReadStats()).toEqual({ skippedLines: 1 });
  });
});
