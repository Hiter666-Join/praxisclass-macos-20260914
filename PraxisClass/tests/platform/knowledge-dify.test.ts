import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPlatformDao } from '@/lib/platform/db/dao';
import {
  difyCreateDocumentByText,
  difyListDocuments,
  difyRetrieve,
  resolveDifyCredentials,
} from '@/lib/platform/knowledge/dify';

vi.mock('@/lib/server/ssrf-guard', () => ({
  validateUrlForSSRF: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/platform/db/dao', () => ({
  getPlatformDao: vi.fn().mockResolvedValue({ listKnowledge: () => [] }),
}));

const creds = {
  baseUrl: 'https://api.dify.test/v1',
  datasetId: 'dataset-1',
  apiKey: 'secret',
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Dify knowledge client', () => {
  it('lists real cloud documents with safe display fields and accurate availability', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/documents?')
          ? jsonResponse({
              total: 2,
              data: [
                {
                  id: 'doc-1',
                  name: '讲义.pdf',
                  indexing_status: 'completed',
                  enabled: true,
                  archived: false,
                  created_by: 'private-owner',
                },
                {
                  id: 'doc-2',
                  name: '停用.pdf',
                  indexing_status: 'completed',
                  enabled: false,
                  archived: false,
                },
              ],
            })
          : jsonResponse({ name: '教学资料', created_by: 'private-owner' }),
      ),
    );
    await expect(difyListDocuments(creds)).resolves.toEqual({
      name: '教学资料',
      total: 2,
      documents: [
        {
          id: 'doc-1',
          name: '讲义.pdf',
          indexingStatus: 'completed',
          available: true,
          disabled: false,
        },
        {
          id: 'doc-2',
          name: '停用.pdf',
          indexingStatus: 'completed',
          available: false,
          disabled: true,
        },
      ],
    });
  });

  it('resolves override and environment credentials atomically', () => {
    vi.stubEnv('DIFY_BASE_URL', 'https://env.dify.test/v1');
    vi.stubEnv('DIFY_DATASET_ID', 'env-dataset');
    vi.stubEnv('DIFY_DATASET_API_KEY', 'env-key');

    expect(resolveDifyCredentials({ baseUrl: 'https://partial.dify.test/v1' })).toBeNull();
    expect(
      resolveDifyCredentials({
        baseUrl: 'https://override.dify.test/v1',
        datasetId: 'override-dataset',
        apiKey: 'override-key',
      }),
    ).toEqual({
      baseUrl: 'https://override.dify.test/v1',
      datasetId: 'override-dataset',
      apiKey: 'override-key',
    });
    expect(resolveDifyCredentials()).toEqual({
      baseUrl: 'https://env.dify.test/v1',
      datasetId: 'env-dataset',
      apiKey: 'env-key',
    });
  });

  it('accepts a server-side DIFY_API_KEY alias without mixing partial overrides', () => {
    vi.stubEnv('DIFY_BASE_URL', 'https://env.dify.test/v1');
    vi.stubEnv('DIFY_DATASET_ID', 'env-dataset');
    vi.stubEnv('DIFY_DATASET_API_KEY', '');
    vi.stubEnv('DIFY_API_KEY', ' alias-key ');
    expect(resolveDifyCredentials()?.apiKey).toBe('alias-key');
    expect(resolveDifyCredentials({ baseUrl: 'https://other.dify.test/v1' })).toBeNull();
    vi.stubEnv('DIFY_DATASET_API_KEY', 'dataset-key');
    expect(resolveDifyCredentials()?.apiKey).toBe('dataset-key');
  });

  it('maps retrieval records and parses the source line', async () => {
    let sentBody = '';
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      sentBody = String(init?.body ?? '');
      return jsonResponse({
        records: [
          {
            segment: {
              content: '【名称】排序\n【内容】快速排序\n【来源】教材 A\n【适用环节】导入',
              document: { name: '快速排序' },
            },
            score: 0.91,
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(difyRetrieve(creds, '排序', 3)).resolves.toEqual([
      {
        title: '快速排序',
        content: expect.any(String),
        source: '教材 A',
        stage: '导入',
        score: 0.91,
      },
    ]);
    expect(JSON.parse(sentBody)).toEqual({ query: '排序' });
  });

  it('preserves PDF evidence and uses the document name when no source marker exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          records: [
            {
              segment: { content: '整数运算可以精确计算。', document: { name: '程序入门.pdf' } },
              score: 0.9,
            },
            {
              segment: { content: '第二个片段。', document: { name: '程序入门.pdf' } },
              score: 0.8,
            },
          ],
        }),
      ),
    );
    await expect(difyRetrieve(creds, '整数', 1)).resolves.toEqual([
      {
        title: '程序入门.pdf',
        content: '整数运算可以精确计算。',
        source: '程序入门.pdf',
        stage: '',
        score: 0.9,
      },
    ]);
    expect(getPlatformDao).not.toHaveBeenCalled();
  });

  it('allows a valid cloud retrieval to finish after the former eight-second timeout', async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), milliseconds);
      return controller.signal;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: unknown, init: RequestInit) =>
          new Promise((resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            setTimeout(() => resolve(jsonResponse({ records: [] })), 11000);
          }),
      ),
    );
    const retrieval = difyRetrieve(creds, 'query');
    await vi.advanceTimersByTimeAsync(11000);
    await expect(retrieval).resolves.toEqual([]);
  });

  it('returns null for a non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    await expect(difyRetrieve(creds, 'query')).resolves.toBeNull();
  });

  it('returns null when fetch aborts', async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    await expect(difyRetrieve(creds, 'query')).resolves.toBeNull();
  });

  it('returns null when records are missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ query: {} })));
    await expect(difyRetrieve(creds, 'query')).resolves.toBeNull();
  });

  it('returns document and batch ids after create-by-text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ document: { id: 'doc-1' }, batch: 'batch-1' })),
    );
    await expect(difyCreateDocumentByText(creds, 'Name', 'Text')).resolves.toEqual({
      documentId: 'doc-1',
      batch: 'batch-1',
    });
  });
});
