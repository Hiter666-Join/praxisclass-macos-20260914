'use client';

import { useSettingsStore } from '@/lib/store/settings';
import { difyOverride } from './use-knowledge-api';
import type { ManagedKnowledgeDocument } from '@/lib/platform/knowledge/documents/types';

export type DocumentSummary = Omit<ManagedKnowledgeDocument, 'entries' | 'remote'> & {
  entryCount: number;
  hasRemote: boolean;
};
export const DOCUMENTS_API = '/api/platform/knowledge/documents';
export function currentParserConfig() {
  const settings = useSettingsStore.getState();
  const providerId = settings.pdfProviderId;
  const config = settings.pdfProvidersConfig[providerId];
  return {
    providerId,
    apiKey: config?.apiKey,
    baseUrl: config?.baseUrl,
    accessKeyId: config?.accessKeyId,
    accessKeySecret: config?.accessKeySecret,
  };
}
export async function documentApi<T>(suffix = '', init?: RequestInit): Promise<T> {
  const response = await fetch(`${DOCUMENTS_API}${suffix}`, init);
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? '请先从教师入口进入，再管理资料'
        : result.error || '资料请求失败，请稍后重试',
    );
  return result as T;
}
export async function documentAction(
  action: string,
  doc: Pick<ManagedKnowledgeDocument, 'id' | 'revision'>,
  extra: Record<string, unknown> = {},
) {
  return documentApi<{ document: ManagedKnowledgeDocument }>('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      id: doc.id,
      revision: doc.revision,
      dify: difyOverride(),
      ...extra,
    }),
  });
}
