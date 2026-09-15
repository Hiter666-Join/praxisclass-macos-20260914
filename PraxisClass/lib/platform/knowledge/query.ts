import { difyRetrieve, resolveDifyCredentials } from './dify';
import type { DifyCredentials, KnowledgeQueryResult } from './types';

export class KnowledgeQueryError extends Error {
  constructor(public readonly code: 'dify_unconfigured' | 'dify_unavailable') {
    super(code);
  }
}

/** Optional remote retrieval. Never read or fall back to the retired local library. */
export async function queryKnowledge(
  query: string,
  topK: number,
  override?: Partial<DifyCredentials>,
): Promise<KnowledgeQueryResult> {
  const creds = resolveDifyCredentials(override);
  if (!creds) throw new KnowledgeQueryError('dify_unconfigured');
  const items = await difyRetrieve(creds, query, topK);
  if (items === null) throw new KnowledgeQueryError('dify_unavailable');
  return { items: items.slice(0, topK), source: 'dify' };
}
