import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import type { DifyCredentials } from '../types';
import { entrySource, type ManagedKnowledgeDocument } from './types';

async function request(creds: DifyCredentials, suffix: string, init?: RequestInit) {
  if (await validateUrlForSSRF(creds.baseUrl)) throw new Error('Dify 地址不可用');
  let response: Response;
  try {
    response = await fetch(
      `${creds.baseUrl}/datasets/${encodeURIComponent(creds.datasetId)}/${suffix}`,
      {
        ...init,
        redirect: 'error',
        headers: { Authorization: `Bearer ${creds.apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
      },
    );
  } catch {
    throw new Error('Dify 请求超时或连接失败，请稍后重试');
  }
  if (!response.ok && !(init?.method === 'DELETE' && response.status === 404)) {
    throw new Error(`Dify 请求失败（${response.status}），请检查连接、权限和索引配置`);
  }
  return response;
}

export function renderManagedDocument(doc: ManagedKnowledgeDocument) {
  return doc.entries
    .filter((entry) => entry.enabled)
    .map((entry) => {
      const source = entrySource(doc, entry);
      return `【来源】${source}\n【案例】${doc.caseName}\n【名称】${entry.title}\n【内容】${entry.content}\n【来源】${source}`;
    })
    .join('\n\n---\n\n');
}

export async function syncManagedDocument(creds: DifyCredentials, doc: ManagedKnowledgeDocument) {
  if (
    doc.remote &&
    (doc.remote.baseUrl !== creds.baseUrl || doc.remote.datasetId !== creds.datasetId)
  )
    throw new Error('该资料绑定的 Dify 知识库与当前配置不同，请恢复原配置后操作');
  // Recover a previous create whose response was lost before storing its ID.
  let remoteId = doc.remote?.id;
  if (!remoteId) {
    const listed = await request(
      creds,
      `documents?keyword=${encodeURIComponent(doc.id)}&limit=100`,
    );
    const body = await listed.json();
    if (!Array.isArray(body.data) || body.has_more)
      throw new Error('Dify 文档列表无效，请检查远端资料后重试');
    const matches = body.data.filter(
      (item: { id?: unknown; name?: unknown }) =>
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        item.name.endsWith(`[${doc.id}]`),
    );
    if (matches.length > 1) throw new Error('Dify 存在重复关联资料，请先在远端整理');
    remoteId = matches[0]?.id;
  }
  const suffix = remoteId
    ? `documents/${encodeURIComponent(remoteId)}/update-by-text`
    : 'document/create-by-text';
  const response = await request(creds, suffix, {
    method: 'POST',
    body: JSON.stringify({
      name: `[${doc.caseName}] ${doc.fileName} [${doc.id}]`,
      text: renderManagedDocument(doc),
      ...(remoteId ? {} : { indexing_technique: 'high_quality' }),
      process_rule: {
        mode: 'custom',
        rules: {
          pre_processing_rules: [],
          segmentation: { separator: '\n\n---\n\n', max_tokens: 2000 },
        },
      },
    }),
  });
  const body = await response.json();
  if (typeof body.document?.id !== 'string' || typeof body.batch !== 'string')
    throw new Error('Dify 返回的文档状态无效');
  return {
    id: body.document.id as string,
    batch: body.batch as string,
    baseUrl: creds.baseUrl,
    datasetId: creds.datasetId,
    revision: doc.revision,
  };
}

export async function managedIndexStatus(
  creds: DifyCredentials,
  remote: NonNullable<ManagedKnowledgeDocument['remote']>,
) {
  if (remote.baseUrl !== creds.baseUrl || remote.datasetId !== creds.datasetId)
    throw new Error('Dify 配置与资料绑定的知识库不同');
  const response = await request(
    creds,
    `documents/${encodeURIComponent(remote.batch)}/indexing-status`,
  );
  const body = await response.json();
  const item = Array.isArray(body.data)
    ? body.data.find((row: { id?: string }) => row.id === remote.id)
    : null;
  if (!item) throw new Error('Dify 未返回该资料的索引状态');
  if (item.indexing_status === 'error' || item.indexing_status === 'paused')
    throw new Error('Dify 索引失败或已暂停，请检查服务后重试同步');
  return item.indexing_status === 'completed';
}

export async function deleteManagedRemote(
  creds: DifyCredentials,
  remote: NonNullable<ManagedKnowledgeDocument['remote']>,
) {
  if (remote.baseUrl !== creds.baseUrl || remote.datasetId !== creds.datasetId)
    throw new Error('请恢复资料原来的 Dify 配置后删除');
  await request(creds, `documents/${encodeURIComponent(remote.id)}`, { method: 'DELETE' });
}
