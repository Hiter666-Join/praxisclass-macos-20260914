import { afterEach, expect, test, vi } from 'vitest';
import { addEvaluation } from '@/lib/pbl/v2/operations/runtime/evaluation';
import { mirrorTestResult } from '@/lib/platform/mirror/client';
import type { PBLProjectV2 } from '@/lib/pbl/v2/types';

vi.mock('@/lib/platform/mirror/client', () => ({ mirrorTestResult: vi.fn() }));
vi.mock('@/lib/runtime/learner-key', () => ({ getLearnerKey: async () => 'student-a' }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

function project(): PBLProjectV2 {
  return { title: '实际成果', description: '', proficiency: 'beginner', language: 'zh-CN', tags: [],
    status: 'active', uiPhase: 'workspace', roles: [], milestones: [], submissions: [], evaluations: [],
    threads: [], engagementEvents: [], runtimeEvents: [], createdAt: '2026-09-14T00:00:00Z', updatedAt: '2026-09-14T00:00:00Z' };
}

test('narrative-only feedback is preserved without fabricating a perfect numeric result', async () => {
  vi.stubGlobal('window', { location: { pathname: '/classroom/course-a' } });
  const current = project();
  const result = addEvaluation(current, { kind: 'task', microtaskId: 'm1', feedback: '还需要补充判断依据' });
  await Promise.resolve();
  expect(current.evaluations).toContain(result);
  expect(result.feedback).toBe('还需要补充判断依据');
  expect(mirrorTestResult).not.toHaveBeenCalled();
});

test.each([{ score: 0, expected: 0, passed: false }, { score: 75, expected: 0.75, passed: true }, { stars: 2, expected: 0.4, passed: false }])(
  'numeric evaluation mirrors the actual value: %j', async ({ score, stars, expected, passed }) => {
    vi.stubGlobal('window', { location: { pathname: '/classroom/course-a' } });
    addEvaluation(project(), { kind: 'task', microtaskId: 'm1', feedback: '基于本次成果', score, stars });
    await Promise.resolve();
    expect(mirrorTestResult).toHaveBeenCalledWith(expect.objectContaining({ score: expected, passed, stageId: 'course-a', learnerKey: 'student-a' }));
  },
);

test('non-finite scores do not enter learning statistics', async () => {
  vi.stubGlobal('window', { location: { pathname: '/classroom/course-a' } });
  addEvaluation(project(), { kind: 'task', feedback: '待评阅', score: Number.NaN });
  await Promise.resolve();
  expect(mirrorTestResult).not.toHaveBeenCalled();
});
