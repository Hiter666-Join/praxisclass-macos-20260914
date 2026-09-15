import { expect, test, vi } from 'vitest';
import { completeCourseRepairs, courseCompletionFailure } from '@/lib/server/agent-runtime/course-completion';

test('an exhausted defect cannot become a successful task, while unavailable execution is not a content defect', () => {
  expect(courseCompletionFailure([{ stageId: 'a', issues: ['按钮结果错误'] }])).toContain('a: 按钮结果错误');
  expect(courseCompletionFailure([{ stageId: 'a', issues: [], unavailable: ['Chrome unavailable'] }])).toBeUndefined();
});

test('valid courses invoke no additional model turn', async () => {
  const prompt = vi.fn();
  await completeCourseRepairs({
    inspect: async () => [{ stageId: 'a', issues: [] }],
    prompt,
    stopped: () => false,
  });
  expect(prompt).not.toHaveBeenCalled();
});

test('failed course evidence returns to the agent and is rechecked after its repair', async () => {
  let issues = ['p1 script: Unexpected token'];
  const prompt = vi.fn(async (text: string) => {
    expect(text).toContain(issues[0]);
    issues = [];
  });
  await completeCourseRepairs({
    inspect: async () => [{ stageId: 'a', issues }],
    prompt,
    stopped: () => false,
  });
  expect(prompt).toHaveBeenCalledOnce();
});

test('no progress ends as incomplete without burning repeated repair turns', async () => {
  const prompt = vi.fn(async () => {});
  await expect(
    completeCourseRepairs({
      inspect: async () => [{ stageId: 'a', issues: ['p1 syntax error'] }],
      prompt,
      stopped: () => false,
    }),
  ).resolves.toEqual([{ stageId: 'a', issues: ['p1 syntax error'] }]);
  expect(prompt).toHaveBeenCalledOnce();
});

test('cancellation or a user question does not start an unsolicited repair turn', async () => {
  const inspect = vi.fn();
  await completeCourseRepairs({ inspect, prompt: vi.fn(), stopped: () => true });
  expect(inspect).not.toHaveBeenCalled();
});

test('missing browser conditions do not burn content-repair model turns', async () => {
  const prompt = vi.fn();
  await expect(
    completeCourseRepairs({
      inspect: async () => [{ stageId: 'a', issues: [], unavailable: ['Chrome unavailable'] }],
      prompt,
      stopped: () => false,
    }),
  ).resolves.toEqual([{ stageId: 'a', issues: [], unavailable: ['Chrome unavailable'] }]);
  expect(prompt).not.toHaveBeenCalled();
});
