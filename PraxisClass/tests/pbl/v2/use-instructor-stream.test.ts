import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertNotStreamError,
  runOneStream,
} from '@/components/scene-renderers/pbl/v2/use-instructor-stream';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import type { PBLProjectV2 } from '@/lib/pbl/v2/types';

vi.mock('@/lib/utils/model-config', () => ({ getCurrentModelConfig: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

describe('PBL v2 — instructor stream errors', () => {
  it('surfaces SSE error events instead of silently swallowing them', () => {
    expect(() =>
      assertNotStreamError({
        type: 'error',
        code: 'STREAM_ERROR',
        message: 'Invalid prompt: messages must not be empty',
      }),
    ).toThrow('STREAM_ERROR: Invalid prompt: messages must not be empty');
  });

  it.each([{ mode: 'disabled' as const }, { mode: 'enabled' as const }, undefined])(
    'forwards the current settings to the PBL request: %j',
    async (thinkingConfig) => {
      vi.mocked(getCurrentModelConfig).mockReturnValue({
        providerId: 'deepseek',
        modelId: 'deepseek-v4-pro',
        modelString: 'deepseek:deepseek-v4-pro',
        apiKey: 'test-key',
        baseUrl: 'http://localhost:3004/v1',
        providerType: 'openai',
        requiresApiKey: true,
        isServerConfigured: false,
        thinkingConfig,
      });
      const fetchMock = vi.fn().mockResolvedValue(new Response('data: {"type":"done"}\n\n'));
      vi.stubGlobal('fetch', fetchMock);
      const project = { title: 'PBL test' } as PBLProjectV2;
      await runOneStream({
        endpoint: '/api/pbl/v2/instructor',
        body: { project, message: 'continue' },
        startingProject: project,
        setDraftAssistant: () => {},
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/pbl/v2/instructor');
      expect(init.headers).toMatchObject({
        'x-model': 'deepseek:deepseek-v4-pro',
        'x-api-key': 'test-key',
        'x-base-url': 'http://localhost:3004/v1',
      });
      expect(JSON.parse(init.body)).toEqual({
        project,
        message: 'continue',
        ...(thinkingConfig ? { thinkingConfig } : {}),
      });
    },
  );
});
