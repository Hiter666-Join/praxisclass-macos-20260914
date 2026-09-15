import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SqliteDatabase } from '@/lib/platform/db/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as testResult } from '@/app/api/platform/test-result/route';
import { POST as feedback } from '@/app/api/platform/feedback/route';
import { POST as memory } from '@/app/api/platform/memory/route';
import { GET as dashboard } from '@/app/api/platform/dashboard/route';
import { getPlatformDao, resetPlatformDaoForTests } from '@/lib/platform/db/dao';
import { readMemory, writeMemory } from '@/lib/platform/memory/store';
import { configureRuntimeStorage, resetRuntimeStorageForTests } from '@/lib/runtime/config';
import { getLearnerKey } from '@/lib/runtime/learner-key';
import { useSettingsMode } from '@/lib/store/settings-mode';

const learner = 'anon:simulation-student';
const body = {
  suite: 'quiz',
  case_id: 'q1',
  stage_id: 'stage',
  scene_id: 'scene',
  learner_key: learner,
  attempt_id: 'one',
  attempt_total: 1,
  passed: true,
  score: 1,
  record_kind: 'learning',
};
const post = (route: string, data: unknown, role: 'teacher' | 'student') =>
  new Request(`http://localhost/api/platform/${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-praxis-role': role,
      'x-learner-key': learner,
    },
    body: JSON.stringify(data),
  });

describe.each(['sqlite', 'jsonl'] as const)('%s learning isolation', (driver) => {
  let directory = '';
  beforeEach(() => {
    resetPlatformDaoForTests();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-learning-'));
    vi.stubEnv('PLATFORM_DATA_DIR', directory);
    vi.stubEnv('PLATFORM_DB_DRIVER', driver);
    vi.stubEnv('TEACHER_PIN', '');
  });
  afterEach(() => {
    resetPlatformDaoForTests();
    if (
      path.dirname(path.resolve(directory)) === path.resolve(os.tmpdir()) &&
      path.basename(directory).startsWith('praxis-learning-')
    )
      fs.rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });
  it('separates teacher rehearsal at ingestion and in default teacher/student statistics', async () => {
    expect((await testResult(post('test-result', body, 'student'))).status).toBe(201);
    expect(
      (await testResult(post('test-result', { ...body, attempt_id: 'teacher-demo' }, 'teacher')))
        .status,
    ).toBe(201);
    const dao = await getPlatformDao();
    expect(dao.listTestResults({ recordKind: 'demo' })[0]).toMatchObject({
      learner_key: `demo:${learner}`,
      record_kind: 'demo',
    });
    for (const scope of ['self', 'all']) {
      const response = await dashboard(
        new Request(`http://localhost/api/platform/dashboard?scope=${scope}`, {
          headers: { 'x-learner-key': learner },
        }),
      );
      expect(await response.json()).toMatchObject({
        overview: { testResultCount: 1 },
        learning: { attemptCount: 1 },
      });
    }
    const demos = await dashboard(
      new Request('http://localhost/api/platform/dashboard?scope=all&recordKind=demo'),
    );
    expect(await demos.json()).toMatchObject({ overview: { testResultCount: 1 } });
    const another = await dashboard(
      new Request('http://localhost/api/platform/dashboard?scope=self', {
        headers: { 'x-learner-key': 'anon:other-student' },
      }),
    );
    expect(await another.json()).toMatchObject({ overview: { testResultCount: 0 } });
  });
  it('stores learner feedback on the platform and skips teacher/demo distillation', async () => {
    await writeMemory('learner', learner, { memory: 'student-sentinel' });
    const response = await feedback(
      post(
        'feedback',
        {
          form_type: 'learner_session',
          subject_id: learner,
          course_id: 'stage',
          ratings: { understanding: 4 },
          text: { blocker_text: 'simulation-only' },
          record_kind: 'learning',
        },
        'student',
      ),
    );
    expect(response.status).toBe(201);
    expect(
      (await getPlatformDao()).listFeedback({ subjectId: learner, recordKind: 'learning' }),
    ).toHaveLength(1);
    const skipped = await memory(
      post(
        'memory?scope=learner',
        {
          action: 'distill',
          sessionId: 'stage',
          events: [{ eventType: 'task_completed', summary: 'teacher rehearsal' }],
        },
        'teacher',
      ),
    );
    expect(skipped.status).toBe(202);
    expect((await readMemory('learner', learner)).memory).toBe('student-sentinel');
    expect(
      (await getPlatformDao()).listMemoryEvents({ scope: 'learner', subjectId: learner }),
    ).toHaveLength(0);
  });
  it('preserves old rows as unclassified instead of assigning them a learning source', async () => {
    if (driver === 'sqlite') {
      const moduleName = 'node:sqlite';
      const { DatabaseSync } = (await import(moduleName)) as {
        DatabaseSync: new (fileName: string) => SqliteDatabase;
      };
      const db = new DatabaseSync(path.join(directory, 'platform.db'));
      db.exec(
        "CREATE TABLE test_results (id TEXT PRIMARY KEY, suite TEXT, case_id TEXT, learner_key TEXT, course_id TEXT, course_version TEXT, dimension TEXT, passed INTEGER, score REAL, duration_ms INTEGER, failure_reason TEXT, idempotency_key TEXT, created_at INTEGER); INSERT INTO test_results VALUES ('old', 'quiz', 'q1', 'anon:simulation-student', 'stage', 'v1', NULL, 1, 1, NULL, NULL, NULL, 1)",
      );
      db.close();
    } else {
      fs.mkdirSync(path.join(directory, 'platform'));
      fs.writeFileSync(
        path.join(directory, 'platform', 'test_results.jsonl'),
        JSON.stringify({
          id: 'old',
          suite: 'quiz',
          case_id: 'q1',
          learner_key: learner,
          course_id: 'stage',
          course_version: 'v1',
          passed: 1,
          score: 1,
          created_at: 1,
        }) + '\n',
      );
    }
    const dao = await getPlatformDao();
    expect(dao.listTestResults({ recordKind: 'legacy' })).toHaveLength(1);
    expect(dao.listTestResults({ recordKind: 'learning' })).toHaveLength(0);
    expect(dao.listTestResults()[0].id).toBe('old');
  });
});

describe('runtime role partitions', () => {
  afterEach(() => {
    resetRuntimeStorageForTests();
    vi.unstubAllGlobals();
    useSettingsMode.setState({ mode: 'teacher' });
  });
  it('restores the same student partition after a teacher rehearsal', async () => {
    resetRuntimeStorageForTests();
    configureRuntimeStorage({ learnerKey: () => learner });
    vi.stubGlobal('window', {});
    useSettingsMode.setState({ mode: 'student' });
    expect(await getLearnerKey()).toBe(learner);
    useSettingsMode.setState({ mode: 'teacher' });
    expect(await getLearnerKey()).toBe(`demo:${learner}`);
    useSettingsMode.setState({ mode: 'student' });
    expect(await getLearnerKey()).toBe(learner);
  });
});
