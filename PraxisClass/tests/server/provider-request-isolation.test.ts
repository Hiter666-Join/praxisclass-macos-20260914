import { afterEach, describe, expect, it, vi } from 'vitest';
import { runWithProviderRequest } from '@/lib/server/provider-request-context';
import {
  resolveApiKey,
  resolveBaseUrl,
  getServerProviders,
  resolveServerMediaExtractorConfig,
} from '@/lib/server/provider-config';
import { GET } from '@/app/api/server-providers/route';

afterEach(() => vi.unstubAllEnvs());

describe('personal teacher and student provider requests', () => {
  it('keeps concurrent credentials separate and never falls back to deployment credentials', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'deployment-secret');
    const results = await Promise.all(
      ['teacher', 'student'].map((role) => {
        const request = new Request('http://localhost/api/chat', {
          headers: { 'x-praxis-role': role },
        });
        return runWithProviderRequest(request, async () => {
          await Promise.resolve();
          return {
            key: resolveApiKey('openai', `${role}-key`),
            missing: resolveApiKey('openai'),
            url: resolveBaseUrl('openai', `https://${role}.example/v1`),
            providers: getServerProviders(),
            mediaFallback: resolveServerMediaExtractorConfig().allowEnvFallback,
          };
        });
      }),
    );
    expect(results).toEqual(
      ['teacher', 'student'].map((role) => ({
        key: `${role}-key`,
        missing: '',
        url: `https://${role}.example/v1`,
        providers: {},
        mediaFallback: false,
      })),
    );
  });

  it('returns no automatic provider setup for either source-default profile', async () => {
    for (const role of ['teacher', 'student']) {
      const response = await GET(
        new Request(`http://localhost/api/server-providers?scope=${role}`),
      );
      const data = await response.json();
      for (const section of ['providers', 'tts', 'asr', 'pdf', 'image', 'video', 'webSearch'])
        expect(data[section]).toEqual({});
    }
  });
});
