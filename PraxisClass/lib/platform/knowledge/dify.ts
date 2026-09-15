import { parseSourceLine, parseStageLine } from '@/lib/platform/knowledge/render';
import type {
  DifyCredentials,
  DifyDocumentList,
  NormalizedItem,
} from '@/lib/platform/knowledge/types';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function resolveDifyCredentials(
  override: Partial<DifyCredentials> = {},
): DifyCredentials | null {
  const overrideBaseUrl = (override.baseUrl ?? '').trim();
  const overrideDatasetId = (override.datasetId ?? '').trim();
  const overrideApiKey = (override.apiKey ?? '').trim();
  const hasOverride = Boolean(overrideBaseUrl || overrideDatasetId || overrideApiKey);
  const baseUrl = (hasOverride ? overrideBaseUrl : (process.env.DIFY_BASE_URL ?? ''))
    .trim()
    .replace(/\/+$/, '');
  const datasetId = (hasOverride ? overrideDatasetId : (process.env.DIFY_DATASET_ID ?? '')).trim();
  const apiKey = hasOverride
    ? overrideApiKey
    : process.env.DIFY_DATASET_API_KEY?.trim() || process.env.DIFY_API_KEY?.trim() || '';
  return baseUrl && datasetId && apiKey ? { baseUrl, datasetId, apiKey } : null;
}

export async function difyRetrieve(
  creds: DifyCredentials,
  query: string,
  topK = 5,
): Promise<NormalizedItem[] | null> {
  try {
    if (await validateUrlForSSRF(creds.baseUrl)) return null;
    const response = await fetch(
      `${creds.baseUrl}/datasets/${encodeURIComponent(creds.datasetId)}/retrieve`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: [...query].slice(0, 250).join(''),
          // Omit retrieval_model to preserve the dataset's search, reranking and
          // score settings. topK is an upper bound on the returned records.
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (response.status !== 200) return null;
    const payload = record(await response.json());
    if (!Array.isArray(payload.records)) return null;
    const items = payload.records.slice(0, topK).map((raw) => {
      const value = record(raw);
      const segment = record(value.segment);
      const document = record(segment.document);
      const content = typeof segment.content === 'string' ? segment.content : '';
      return {
        title: typeof document.name === 'string' ? document.name : '',
        content,
        // Use only remote evidence; local library entries are no longer part of retrieval.
        source:
          parseSourceLine(content) || (typeof document.name === 'string' ? document.name : ''),
        stage: parseStageLine(content) ?? '',
        score: Number(value.score) || 0,
        ...(typeof document.id === 'string' ? { documentId: document.id } : {}),
      };
    });
    return items;
  } catch {
    return null;
  }
}

export async function difyListDocuments(creds: DifyCredentials): Promise<DifyDocumentList | null> {
  try {
    if (await validateUrlForSSRF(creds.baseUrl)) return null;
    const datasetUrl = `${creds.baseUrl}/datasets/${encodeURIComponent(creds.datasetId)}`;
    const options = {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
      signal: AbortSignal.timeout(15000),
    };
    const [datasetResponse, documentsResponse] = await Promise.all([
      fetch(datasetUrl, options),
      fetch(`${datasetUrl}/documents?page=1&limit=100`, options),
    ]);
    if (!datasetResponse.ok || !documentsResponse.ok) return null;
    const dataset = record(await datasetResponse.json());
    const payload = record(await documentsResponse.json());
    if (!Array.isArray(payload.data)) return null;
    return {
      name: typeof dataset.name === 'string' ? dataset.name : '',
      total: typeof payload.total === 'number' ? payload.total : payload.data.length,
      documents: payload.data.map((raw) => {
        const document = record(raw);
        return {
          id: typeof document.id === 'string' ? document.id : '',
          name: typeof document.name === 'string' ? document.name : '',
          indexingStatus:
            typeof document.indexing_status === 'string' ? document.indexing_status : '',
          available:
            document.indexing_status === 'completed' &&
            document.enabled === true &&
            document.archived !== true,
          disabled: document.enabled === false || document.archived === true,
        };
      }),
    };
  } catch {
    return null;
  }
}

export async function difyCreateDocumentByText(
  creds: DifyCredentials,
  name: string,
  text: string,
): Promise<{ documentId: string; batch: string } | null> {
  try {
    if (await validateUrlForSSRF(creds.baseUrl)) return null;
    const response = await fetch(
      `${creds.baseUrl}/datasets/${encodeURIComponent(creds.datasetId)}/document/create-by-text`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          text,
          indexing_technique: 'high_quality',
          process_rule: { mode: 'automatic' },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (response.status !== 200) return null;
    const payload = record(await response.json());
    const document = record(payload.document);
    if (typeof document.id !== 'string' || typeof payload.batch !== 'string') return null;
    return { documentId: document.id, batch: payload.batch };
  } catch {
    return null;
  }
}

export async function difyTestConnection(
  creds: DifyCredentials,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const error = await validateUrlForSSRF(creds.baseUrl);
    if (error) return { ok: false, error };
    const response = await fetch(
      `${creds.baseUrl}/datasets/${encodeURIComponent(creds.datasetId)}/documents?limit=1`,
      {
        headers: { Authorization: `Bearer ${creds.apiKey}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    return { ok: response.status === 200, status: response.status };
  } catch {
    return { ok: false, error: 'request_failed' };
  }
}
