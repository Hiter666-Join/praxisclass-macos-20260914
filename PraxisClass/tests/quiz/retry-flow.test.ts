import { describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { BrowserRuntimeStore } from '@praxis/storage';
import {
  createQuizAttemptWriter,
  loadQuizAttemptState,
  quizAttemptId,
  recordQuizAttempt,
} from '@/lib/quiz/runtime';
import { persistQuizRetry, persistQuizReview, persistQuizSubmission } from '@/lib/quiz/view-state';
import type { QuestionResult } from '@/lib/quiz/grading';

const { mirrorMany } = vi.hoisted(() => ({ mirrorMany: vi.fn() }));
vi.mock('@/lib/platform/mirror/client', () => ({ mirrorMany }));

describe('explicit retry through the quiz view persistence contract', () => {
  it('persists and mirrors three attempts even when the last two have identical answers', async () => {
    Object.defineProperty(globalThis, 'IDBKeyRange', { configurable: true, value: IDBKeyRange });
    const store = new BrowserRuntimeStore({ indexedDB: new IDBFactory(), dbName: 'retry-flow' });
    let tick = 0;
    const deps = {
      store,
      learnerKey: 'learner-a',
      now: () => new Date(1_789_000_000_000 + tick++).toISOString(),
      mintRecordId: () => `record-${tick}`,
    };
    const base = { stageId: 'stage-a', sceneId: 'quiz-a' };
    const writer = createQuizAttemptWriter({ write: (input) => recordQuizAttempt(input, deps) });
    let attemptId = quizAttemptId(base.stageId, base.sceneId, deps.learnerKey);
    for (const [index, second] of ['C', 'B', 'B'].entries()) {
      if (index > 0) {
        // The page binds this returned id before accepting another answer.
        attemptId = await persistQuizRetry({ ...base, attemptId }, writer, (input) =>
          loadQuizAttemptState(input, deps),
        );
      }
      const answers = { q1: 'A', q2: second };
      writer.scheduleDraft({ ...base, attemptId, answers });
      await persistQuizSubmission({ ...base, attemptId, answers }, writer);
      const results: QuestionResult[] = [
        { questionId: 'q1', correct: true, status: 'correct', earned: 1 },
        {
          questionId: 'q2',
          correct: second === 'B',
          status: second === 'B' ? 'correct' : 'incorrect',
          earned: second === 'B' ? 1 : 0,
        },
      ];
      await persistQuizReview({ ...base, attemptId, answers, results }, writer);
    }
    const sessions = await store.listSessions(base.stageId, deps.learnerKey);
    expect(sessions).toHaveLength(3);
    expect(sessions.every((session) => session.status === 'completed')).toBe(true);
    expect(mirrorMany).toHaveBeenCalledTimes(3);
    expect(new Set(mirrorMany.mock.calls.map(([rows]) => rows[0].attemptId)).size).toBe(3);
    expect((await loadQuizAttemptState(base, deps)).state?.answers).toEqual({ q1: 'A', q2: 'B' });
  });
});
