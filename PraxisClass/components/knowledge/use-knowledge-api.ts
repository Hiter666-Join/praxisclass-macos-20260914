'use client';

import { useCallback, useEffect, useState } from 'react';

import type { KnowledgeEntryRow } from '@/lib/platform/db/types';
import { useSettingsStore } from '@/lib/store/settings';
import { getCurrentModelConfig } from '@/lib/utils/model-config';

export type KnowledgeEntry = KnowledgeEntryRow;

export type KnowledgeSource = 'dify' | 'local' | 'unknown';

export interface KnowledgeQueryItem {
  title: string;
  content: string;
  source: string;
  score: number;
  sourceUrl?: string;
}

export interface KnowledgePoint {
  name: string;
  source: string;
  stage: string;
  content: string;
  sourceUrl?: string;
}

export interface KnowledgeListResult {
  items: KnowledgeEntry[];
  total: number;
  synced: number;
}

export function difyOverride(): { baseUrl?: string; datasetId?: string; apiKey?: string } | undefined {
  const dify = useSettingsStore.getState().dify;
  if (!dify) return undefined;
  const baseUrl = dify.baseUrl.trim();
  const datasetId = dify.datasetId.trim();
  const apiKey = dify.apiKey.trim();
  if (!baseUrl && !datasetId && !apiKey) return undefined;
  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(datasetId ? { datasetId } : {}),
    ...(apiKey ? { apiKey } : {}),
  };
}

export async function knowledgeCall<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const dify = difyOverride();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (action === 'extract') {
    // `extract` resolves its LLM from the same request headers as scene-outlines-stream.
    const config = getCurrentModelConfig();
    headers['x-model'] = config.modelString || '';
    headers['x-api-key'] = config.apiKey || '';
    headers['x-base-url'] = config.baseUrl || '';
    headers['x-provider-type'] = config.providerType || '';
  }
  const response = await fetch('/api/platform/knowledge', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload, ...(dify ? { dify } : {}) }),
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(body?.error ?? `knowledge_${response.status}`);
  }
  return body as T;
}

export function useKnowledgeList(search: string) {
  const [items, setItems] = useState<KnowledgeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [synced, setSynced] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    knowledgeCall<KnowledgeListResult>('list', { search, limit: 200 })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items ?? []);
        setTotal(result.total ?? 0);
        setSynced(result.synced ?? 0);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setSynced(0);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, nonce]);

  return { items, total, synced, loading, reload };
}
