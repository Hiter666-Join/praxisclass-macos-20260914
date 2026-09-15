import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ read: vi.fn(), stream: vi.fn() }));
vi.mock('@/lib/platform/memory/store', () => ({ readMemory: mocks.read }));
vi.mock('@/lib/platform/auth/require-teacher', () => ({ isTeacherRequest: vi.fn() }));
vi.mock('@/lib/ai/llm', () => ({ streamLLM: mocks.stream }));

import { loadRuntimeTeachingMemory } from '@/lib/platform/memory/teaching-context';
import { withRuntimeTeachingMemoryMessages } from '@/lib/server/agent-runtime/teaching-memory';
import { buildAgent } from '@/lib/agent/runtime/build-agent';
import { createCallLlmStreamFn } from '@/lib/agent/runtime/stream-fn';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({ profile: '教师画像标记', memory: '用借书作类比', updatedAt: 1 });
  mocks.stream.mockImplementation(() => ({
    fullStream: (async function* () {
      yield { type: 'text-delta', text: '回答' };
      yield {
        type: 'finish', finishReason: 'stop',
        totalUsage: { inputTokens: 0, outputTokens: 0, inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0 } },
      };
    })(),
    usage: new Promise(() => {}),
  }));
});

describe('Pro teacher memory', () => {
  it('never reads teacher files for a student session', async () => {
    expect(await loadRuntimeTeachingMemory('student')).toEqual({ status: 'off', instructions: '', data: '' });
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('keeps private background out of durable turns across successive prompts', async () => {
    const memory = await loadRuntimeTeachingMemory('teacher');
    expect(mocks.read).toHaveBeenCalledWith('teacher', 'teacher:main');
    const agent = buildAgent({
      streamFn: createCallLlmStreamFn({ languageModel: {} as never }),
      systemPrompt: memory.instructions,
      tools: [], allowedToolNames: new Set(),
      transformContext: async (messages) => withRuntimeTeachingMemoryMessages(messages, memory),
    });
    const emitted: unknown[] = [];
    agent.subscribe((event) => { if (event.type === 'message_end') emitted.push(event.message); });
    await agent.prompt('本次先解释概念');
    await agent.prompt('继续');
    expect(mocks.stream).toHaveBeenCalledTimes(2);
    for (const [params] of mocks.stream.mock.calls) {
      const transport = JSON.stringify(params.messages);
      expect(transport.match(/教师画像标记/g)).toHaveLength(1);
      expect(transport.indexOf('用借书作类比')).toBeLessThan(transport.indexOf('本次先解释概念'));
      expect(params.system).not.toContain('教师画像标记');
    }
    expect(JSON.stringify(agent.state.messages)).not.toContain('教师画像标记');
    expect(JSON.stringify(emitted)).not.toContain('教师画像标记');
  });

  it('continues without extra context when memory is empty or unavailable', async () => {
    const messages = [{ role: 'user' as const, content: '开始', timestamp: 1 }];
    mocks.read.mockResolvedValue({ profile: '', memory: ' ', updatedAt: null });
    const empty = await loadRuntimeTeachingMemory('teacher');
    expect(empty.status).toBe('empty');
    expect(withRuntimeTeachingMemoryMessages(messages, empty)).toBe(messages);
    mocks.read.mockRejectedValue(new Error('private path'));
    const unavailable = await loadRuntimeTeachingMemory('teacher');
    expect(unavailable).toEqual({ status: 'unavailable', instructions: '', data: '' });
    expect(withRuntimeTeachingMemoryMessages(messages, unavailable)).toBe(messages);
  });
});
