import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/platform/knowledge/route';
import { requireTeacher } from '@/lib/platform/auth/require-teacher';
import { getPlatformDao } from '@/lib/platform/db/dao';
import { documentStore } from '@/lib/platform/knowledge/documents/store';
import { localQuery } from '@/lib/platform/knowledge/local';

vi.mock('@/lib/platform/auth/require-teacher', () => ({
  requireTeacher: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/server/ssrf-guard', () => ({
  validateUrlForSSRF: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/platform/db/dao', () => ({
  getPlatformDao: vi.fn(() => {
    throw new Error('Local entries must not be opened');
  }),
}));
vi.mock('@/lib/platform/knowledge/documents/store', () => ({
  documentStore: vi.fn(() => {
    throw new Error('Local documents must not be opened');
  }),
}));
vi.mock('@/lib/platform/knowledge/local', () => ({
  localQuery: vi.fn(() => {
    throw new Error('Local retrieval must not run');
  }),
}));
vi.mock('@/lib/ai/llm', () => ({ callLLM: vi.fn() }));
vi.mock('@/lib/server/resolve-model', () => ({ resolveModelFromRequest: vi.fn() }));

const dify = { baseUrl: 'https://dify.test/v1', datasetId: 'demo', apiKey: 'test' };
const request = (body: Record<string, unknown>) =>
  new Request('http://localhost/api/platform/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest;

beforeEach(() => {
  for (const name of ['DIFY_BASE_URL', 'DIFY_DATASET_ID', 'DIFY_DATASET_API_KEY', 'DIFY_API_KEY']) {
    vi.stubEnv(name, '');
  }
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  expect(getPlatformDao).not.toHaveBeenCalled();
  expect(documentStore).not.toHaveBeenCalled();
  expect(localQuery).not.toHaveBeenCalled();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Dify-only knowledge API', () => {
  it.each(['list', 'upsert', 'import', 'delete', 'sync'])(
    'retires %s without accessing or changing existing local data',
    async (action) => {
      const response = await POST(request({ action, id: 'existing-entry', text: 'existing data' }));
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({ error: 'local_knowledge_removed' });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('retains teacher access checks for protected actions', async () => {
    vi.mocked(requireTeacher).mockResolvedValueOnce(
      Response.json({ error: 'teacher_required' }, { status: 401 }),
    );
    expect((await POST(request({ action: 'sync' }))).status).toBe(401);
  });

  it('reports missing Dify instead of querying stored local entries', async () => {
    const response = await POST(request({ action: 'query', query: '排序' }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'dify_unconfigured' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns remote evidence without looking up local sources or originals', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        records: [
          {
            segment: {
              content: '二分查找需要有序数据。',
              document: { id: 'remote-1', name: '规范.pdf' },
            },
            score: 0.9,
          },
        ],
      }),
    );
    const response = await POST(request({ action: 'query', query: '二分查找', dify }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      source: 'dify',
      items: [
        {
          title: '规范.pdf',
          content: '二分查找需要有序数据。',
          source: '规范.pdf',
          stage: '',
          score: 0.9,
          documentId: 'remote-1',
        },
      ],
    });
  });

  it('reports a remote failure instead of silently using local knowledge', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({}, { status: 401 }));
    const response = await POST(request({ action: 'query', query: '排序', dify }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'dify_unavailable' });
  });

  it('keeps zero remote matches empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ records: [] }));
    const response = await POST(request({ action: 'query', query: '排序', dify }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ source: 'dify', items: [] });
  });

  it('allows testing Dify without any local database', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ data: [] }));
    const response = await POST(request({ action: 'test', dify }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, configured: true });
  });
});
