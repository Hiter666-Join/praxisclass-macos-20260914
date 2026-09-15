import fs from 'node:fs/promises';
import type { DocumentExtractorConfig } from '@/lib/document/types';
import type { DifyCredentials } from '../types';
import type { ManagedKnowledgeDocument } from './types';
import {
  documentStore,
  getKnowledgeDocument,
  knowledgeFilePath,
  saveKnowledgeDocument,
} from './store';
import { parseKnowledgeDocument } from './extract';
import { deleteManagedRemote, syncManagedDocument } from './dify-documents';

type Job =
  | { id: string; action: 'parse'; config: Partial<DocumentExtractorConfig> }
  | { id: string; action: 'sync' | 'delete'; creds: DifyCredentials | null };
const globalJobs = globalThis as typeof globalThis & {
  praxisKnowledgeJobs?: { queue: Job[]; active: Set<string>; running: Promise<void> | null };
};
const state = (globalJobs.praxisKnowledgeJobs ??= { queue: [], active: new Set(), running: null });
export const hasKnowledgeJob = (id: string) => state.active.has(id);

export function enqueueKnowledgeJob(job: Job) {
  if (state.active.has(job.id)) throw new Error('该资料正在处理，请稍后操作');
  state.active.add(job.id);
  state.queue.push(job);
}

export function runKnowledgeJobs(): Promise<void> {
  if (state.running) return state.running;
  state.running = (async () => {
    while (state.queue.length) {
      const job = state.queue.shift()!;
      let doc: ManagedKnowledgeDocument | undefined;
      try {
        doc = await getKnowledgeDocument(job.id);
        if (!doc) continue;
        doc.error = null;
        if (job.action === 'parse') {
          doc.status = 'parsing';
          await saveKnowledgeDocument(doc);
          const result = await parseKnowledgeDocument(doc, job.config);
          Object.assign(doc, result, { status: 'draft' });
          await saveKnowledgeDocument(doc);
        } else if (job.action === 'sync') {
          if (!job.creds) throw new Error('请先在设置中配置 Dify 知识库');
          doc.status = 'syncing';
          await saveKnowledgeDocument(doc);
          doc.remote = await syncManagedDocument(job.creds, doc);
          doc.status = 'indexing';
          await saveKnowledgeDocument(doc);
        } else {
          if (doc.remote) {
            if (!job.creds) throw new Error('请先配置 Dify，才能删除关联的远端资料');
            await deleteManagedRemote(job.creds, doc.remote);
          }
          await fs.unlink(knowledgeFilePath(doc.id)).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          });
          (await documentStore()).delete(doc.id);
        }
      } catch (error) {
        if (doc) {
          doc.status = 'failed';
          // Provider errors may contain URLs or credentials. Only our bounded,
          // user-facing errors are returned; never persist upstream error bodies.
          const message = error instanceof Error ? error.message : '';
          doc.error =
            /^(Dify |请|解析|PDF |Office |工作表|有效行数|知识片段|未识别|该资料|该解析)/.test(
              message,
            ) && !/https?:|Bearer|api.key/i.test(message)
              ? message.slice(0, 240)
              : '处理失败，请检查解析服务配置、文件格式或稍后重试';
          await saveKnowledgeDocument(doc);
        }
      } finally {
        state.active.delete(job.id);
      }
    }
  })().finally(() => {
    state.running = null;
  });
  return state.running;
}
