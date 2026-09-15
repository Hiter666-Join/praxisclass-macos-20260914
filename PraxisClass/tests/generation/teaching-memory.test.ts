import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  teacher: vi.fn(),
  stream: vi.fn(),
  call: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock('@/lib/platform/memory/store', () => ({ readMemory: mocks.read }));
vi.mock('@/lib/platform/auth/require-teacher', () => ({ isTeacherRequest: mocks.teacher }));
vi.mock('@/lib/ai/llm', () => ({ streamLLM: mocks.stream, callLLM: mocks.call }));
vi.mock('@/lib/server/resolve-model', () => ({ resolveModelFromRequest: mocks.resolve }));
vi.mock('@praxis/generation', async (original) => {
  const actual = await original<typeof import('@praxis/generation')>();
  return {
    ...actual,
    generateSceneContent: async (
      _outline: unknown,
      call: (s: string, u: string) => Promise<string>,
    ) => {
      await call('Content schema rules', 'Create the approved page');
      return { type: 'slide', elements: [] };
    },
    generateSceneActions: async (
      _outline: unknown,
      _content: unknown,
      call: (s: string, u: string) => Promise<string>,
    ) => {
      await call('Narration schema rules', 'Explain the approved page');
      return [];
    },
    buildCompleteScene: () => ({ id: 'test-scene', type: 'slide', actions: [] }),
  };
});

import { loadTeachingMemory, withTeachingMemory } from '@/lib/platform/memory/teaching-context';
import { POST as outlines } from '@/app/api/generate/scene-outlines-stream/route';
import { POST as content } from '@/app/api/generate/scene-content/route';
import { POST as actions } from '@/app/api/generate/scene-actions/route';

const profile = 'PROFILE-TEST：高职机电教师';
const memory = 'MEMORY-TEST：通常先给案例，再给验收清单';
const requirement = '本次仅讲解概念，不使用案例，不安排验收清单';
const outline = {
  id: 'page-1',
  type: 'slide',
  title: '概念说明',
  description: '概念',
  keyPoints: ['定义'],
  order: 1,
};
function request(enabled: boolean, body: object = {}) {
  return new NextRequest('http://localhost/api/generate/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-teacher-memory': String(enabled) },
    body: JSON.stringify({
      requirements: { requirement },
      outline,
      allOutlines: [outline],
      stageId: 'test-stage',
      content: { type: 'slide' },
      ...body,
    }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({ profile, memory, updatedAt: 1 });
  mocks.teacher.mockResolvedValue(true);
  mocks.resolve.mockResolvedValue({
    model: {},
    modelInfo: { capabilities: {}, outputWindow: 4096 },
    modelString: 'test:memory',
  });
  mocks.call.mockResolvedValue({ text: 'OK' });
  mocks.stream.mockImplementation(() => ({
    textStream: (async function* () {
      yield JSON.stringify({ outlines: [outline], languageDirective: '中文' });
    })(),
  }));
});

describe('teacher memory isolation and fallback', () => {
  it('does not read teacher memory for student-mode requests, even with a teacher session', async () => {
    expect((await loadTeachingMemory(request(false))).status).toBe('off');
    expect(mocks.teacher).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('does not trust an opt-in header without teacher authentication', async () => {
    mocks.teacher.mockResolvedValue(false);
    expect((await loadTeachingMemory(request(true))).status).toBe('off');
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('reads only the existing teacher memory and the shipped skill rules', async () => {
    const context = await loadTeachingMemory(request(true));
    expect(mocks.read).toHaveBeenCalledWith('teacher', 'teacher:main');
    expect(context.status).toBe('applied');
    expect(context.instructions).toContain('# Teacher experience reuse');
    const prompts = withTeachingMemory('OUTPUT SCHEMA', 'PAGE', context, requirement);
    expect(prompts.system).not.toContain(profile);
    expect(prompts.system).toContain('take precedence over remembered preferences');
    expect(prompts.user).toContain(memory);
    expect(prompts.user.endsWith(requirement)).toBe(true);
  });
  it('leaves original prompts unchanged for empty memory or read failure', async () => {
    mocks.read.mockResolvedValue({ profile: ' ', memory: '', updatedAt: null });
    const empty = await loadTeachingMemory(request(true));
    expect(empty.status).toBe('empty');
    expect(withTeachingMemory('SYSTEM', 'USER', empty)).toEqual({ system: 'SYSTEM', user: 'USER' });
    mocks.read.mockRejectedValue(new Error('private path must not be returned'));
    const unavailable = await loadTeachingMemory(request(true));
    expect(unavailable).toEqual({ status: 'unavailable', instructions: '', data: '' });
  });
});

describe('existing preparation routes use saved memory', () => {
  it('includes memory in the outline request, reports actual loading, and never echoes it in SSE', async () => {
    const response = await outlines(request(true));
    const result = await response.text();
    expect(response.headers.get('X-Teacher-Memory')).toBe('applied');
    expect(mocks.stream.mock.calls[0][0].prompt).toContain(profile);
    expect(mocks.stream.mock.calls[0][0].prompt).toContain(requirement);
    expect(result).not.toContain(profile);
    expect(result).not.toContain(memory);
  });
  it.each([
    ['content', content],
    ['narration', actions],
  ] as const)('includes memory and current requirements in %s', async (_label, handler) => {
    const response = await handler(request(true));
    expect(response.status).toBe(200);
    expect(mocks.call.mock.calls[0][0].prompt).toContain(memory);
    expect(mocks.call.mock.calls[0][0].prompt.endsWith(requirement)).toBe(true);
    expect(mocks.call.mock.calls[0][0].system).not.toContain(profile);
  });
  it.each([
    ['outline', outlines],
    ['content', content],
    ['narration', actions],
  ] as const)('keeps student %s generation free of teacher memory', async (_label, handler) => {
    const response = await handler(request(false));
    await response.text();
    expect(response.status).toBe(200);
    expect(mocks.read).not.toHaveBeenCalled();
    for (const call of [...mocks.call.mock.calls, ...mocks.stream.mock.calls]) {
      expect(JSON.stringify(call[0])).not.toContain('PROFILE-TEST');
      expect(JSON.stringify(call[0])).not.toContain('MEMORY-TEST');
    }
  });
});
