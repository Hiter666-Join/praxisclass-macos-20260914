import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tool } from 'ai';
import { z } from 'zod';

import { callLLM, streamLLM } from '@/lib/ai/llm';
import { getModel, getProvider } from '@/lib/ai/providers';
import type { ThinkingMode } from '@/lib/types/provider';

vi.mock('@/lib/server/usage-storage', () => ({ recordUsage: vi.fn() }));

const versions = [
  ['xfyun-x2-flash', 'spark-x', '/agent/v1'],
  ['xfyun-x2', 'spark-x', '/x2'],
  ['xfyun-x1-5', 'spark-x', '/v2'],
  ['xfyun-ultra', '4.0Ultra', '/v1'],
  ['xfyun-pro', 'generalv3', '/v1'],
  ['xfyun-pro-128k', 'pro-128k', '/v1'],
  ['xfyun-lite', 'lite', '/v1'],
] as const;

function textResponse() {
  // Spark omits OpenAI's object/model fields and includes code/message/sid.
  return new Response(
    JSON.stringify({
      code: 0,
      message: 'Success',
      sid: 'spark-test',
      id: 'spark-test',
      created: 1,
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

describe('iFLYTEK Spark integration', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_COMPAT_USE_STREAMING_CHAT', 'false');
    vi.stubEnv('LLM_THINKING_DISABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(versions)(
    'sends %s to its own endpoint with its own APIPassword',
    async (providerId, modelId, path) => {
      const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
        textResponse(),
      );
      vi.stubGlobal('fetch', fetchMock);
      const apiKey = `test-password-${providerId}`;
      const { model } = getModel({ providerId, modelId, apiKey });

      const result = await callLLM({ model, prompt: 'hi', maxRetries: 0 }, 'xfyun-test');

      expect(result.text).toBe('ok');
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`https://spark-api-open.xf-yun.com${path}/chat/completions`);
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${apiKey}`);
      expect(JSON.parse(String(init?.body))).toMatchObject({ model: modelId });
      expect(getProvider(providerId)?.supportsModelDiscovery).toBe(false);
    },
  );

  it.each(['enabled', 'disabled', 'auto'] as ThinkingMode[])(
    'maps X2 thinking mode %s through the SDK',
    async (mode) => {
      for (const providerId of ['xfyun-x2', 'xfyun-x2-flash'] as const) {
        const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
          textResponse(),
        );
        vi.stubGlobal('fetch', fetchMock);
        const { model } = getModel({ providerId, modelId: 'spark-x', apiKey: 'test-password' });
        await callLLM({ model, prompt: 'hi', maxRetries: 0 }, 'xfyun-test', undefined, { mode });
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).thinking).toEqual({
          type: mode,
        });
      }
    },
  );

  it('keeps reasoning, answer text and streamed function arguments through the SDK', async () => {
    const deltas = [
      { role: 'assistant', reasoning_content: 'Consider the lesson.' },
      { role: 'assistant', content: 'Opening lesson.' },
      {
        tool_calls: [
          {
            index: 0,
            id: 'call-1',
            type: 'function',
            function: { name: 'open_lesson', arguments: '{"id":' },
          },
        ],
      },
      { tool_calls: [{ index: 0, function: { arguments: '"lesson-1"}' } }] },
    ];
    const chunks = deltas.map((delta) => ({
      code: 0,
      message: 'Success',
      sid: 'spark-test',
      id: 'spark-test',
      created: 1,
      choices: [{ delta, index: 0 }],
    }));
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          chunks.map((chunk) => `data:${JSON.stringify(chunk)}\n\n`).join('') + 'data:[DONE]\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { model } = getModel({
      providerId: 'xfyun-x2-flash',
      modelId: 'spark-x',
      apiKey: 'test-password',
    });
    const result = streamLLM(
      {
        model,
        prompt: 'Open the lesson',
        maxRetries: 0,
        tools: {
          open_lesson: tool({
            description: 'Open lesson',
            inputSchema: z.object({ id: z.string() }),
          }),
        },
      },
      'xfyun-test',
      { mode: 'auto' },
    );
    const parts: Array<Record<string, unknown>> = [];
    for await (const part of result.fullStream) parts.push(part as Record<string, unknown>);

    expect(parts.filter((part) => part.type === 'error')).toEqual([]);
    expect(parts).toContainEqual(
      expect.objectContaining({ type: 'reasoning-delta', text: 'Consider the lesson.' }),
    );
    expect(await result.text).toBe('Opening lesson.');
    expect(await result.toolCalls).toContainEqual(
      expect.objectContaining({ toolName: 'open_lesson', input: { id: 'lesson-1' } }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      stream: true,
      thinking: { type: 'auto' },
      tools: [{ type: 'function', function: { name: 'open_lesson' } }],
    });
  });

  it('does not advertise function calling for Pro and Lite', () => {
    for (const id of ['xfyun-pro', 'xfyun-pro-128k', 'xfyun-lite'] as const) {
      expect(getProvider(id)?.models[0].capabilities?.tools).toBe(false);
    }
  });
});
