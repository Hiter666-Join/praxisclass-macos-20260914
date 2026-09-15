import { expect, test, vi } from 'vitest';
import { InMemorySessionRepo, type SessionTreeEntry, type AgentTool } from '@earendil-works/pi-agent-core';
import { CourseBriefState, COURSE_BRIEF_ENTRY, withCurrentCourseBrief } from '@/lib/server/agent-runtime/course-brief';

const initial = {
  expectedRevision: 0, throughSeq: 0, intent: 'create' as const, goal: 'Java 入门',
  upserts: [
    { id: 'language', text: '使用 Java', sourceSeq: 0, quote: '使用 Java' },
    { id: 'audience', text: '面向零基础学生', sourceSeq: 0, quote: '零基础学生' },
  ], remove: [],
};
const original = '使用 Java，面向零基础学生。';

test('an explicit update replaces only its target and the old request stays auditable across restart', async () => {
  const repo = new InMemorySessionRepo();
  const session = await repo.create();
  const receipts: unknown[] = [];
  const brief = new CourseBriefState(original, async receipt => {
    receipts.push(receipt);
    await session.appendCustomEntry(COURSE_BRIEF_ENTRY, receipt);
  });
  expect(() => brief.assertWritable()).toThrow('最新用户消息');
  await brief.update(initial);
  brief.addMessages([{ seq: 1, text: '改用 Python，其余不变。' }]);
  expect(() => brief.assertWritable()).toThrow('最新用户消息');
  await brief.update({ ...initial, expectedRevision: 1, throughSeq: 1, intent: 'edit',
    upserts: [{ id: 'language', text: '使用 Python', sourceSeq: 1, quote: '改用 Python' }] });
  expect(brief.requirementText()).toContain('零基础学生');
  expect(brief.requirementText()).toContain('Python');
  expect(brief.requirementText()).not.toContain('使用 Java');
  expect(receipts[1]).toMatchObject({ retired: [{ requirement: { text: '使用 Java' }, quote: '改用 Python' }] });
  const tail = await session.appendMessage({ role: 'user', content: '继续', timestamp: 2 });
  await session.appendCompaction('继续当前课程', tail, 100);
  const reopened = await repo.open(await session.getMetadata());
  const restored = new CourseBriefState(original, async () => {});
  restored.addMessages([{ seq: 1, text: '改用 Python，其余不变。' }]);
  restored.restore(await reopened.getBranch());
  expect(restored.snapshot()).toEqual(brief.snapshot());
});

test('cannot weaken a requirement from old evidence or invent an authorizing quotation', async () => {
  const brief = new CourseBriefState(original, async () => {});
  await brief.update(initial);
  await expect(brief.update({ ...initial, expectedRevision: 1,
    remove: [{ id: 'language', sourceSeq: 0, quote: '使用 Java', reason: '生成失败' }], upserts: [] })).rejects.toThrow('用户更新');
  brief.addMessages([{ seq: 1, text: '继续' }]);
  await expect(brief.update({ ...initial, expectedRevision: 1, throughSeq: 1,
    upserts: [{ id: 'language', text: 'Python', sourceSeq: 1, quote: '改用 Python' }] })).rejects.toThrow('逐字引用');
  await expect(brief.update({ ...initial, expectedRevision: 0, throughSeq: 1 })).rejects.toThrow('已更新');
  expect(brief.snapshot().requirements).toHaveLength(2);
});

test('continuation preserves requirements and a read-only commission blocks all course writers, not readers', async () => {
  const brief = new CourseBriefState(original, async () => {});
  await brief.update(initial);
  brief.addMessages([{ seq: 1, text: '继续' }]);
  await brief.update({ ...initial, expectedRevision: 1, throughSeq: 1, upserts: [] });
  expect(brief.snapshot().requirements).toHaveLength(2);
  brief.addMessages([{ seq: 2, text: '先审核，不修改代码或课堂' }]);
  await brief.update({ ...initial, expectedRevision: 2, throughSeq: 2, intent: 'inspect', upserts: [] });
  const execute = vi.fn(async () => ({ content: [], details: {} }));
  const tools = withCurrentCourseBrief(['create_stage', 'patch_stage', 'read_stage'].map(name => ({ name, execute })) as unknown as AgentTool<never, never>[], brief);
  expect(await tools[0].execute('a', {} as never)).toHaveProperty('isError', true);
  expect(await tools[1].execute('b', {} as never)).toHaveProperty('isError', true);
  await tools[2].execute('c', {} as never);
  expect(execute).toHaveBeenCalledOnce();
});

test('failed persistence does not advance the effective brief', async () => {
  const brief = new CourseBriefState(original, async () => { throw new Error('lease lost'); });
  await expect(brief.update(initial)).rejects.toThrow('lease lost');
  expect(brief.snapshot().revision).toBe(0);
  brief.restore([{ type: 'custom', customType: COURSE_BRIEF_ENTRY, data: { revision: 99 } } as SessionTreeEntry]);
  expect(brief.snapshot().revision).toBe(0);
});
