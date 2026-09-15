import fs from 'node:fs';
import path from 'node:path';
import { getPlatformClient } from '@/lib/platform/db/client';
import type { ManagedKnowledgeDocument } from './types';

export function knowledgeFilePath(id: string): string {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('invalid_document_id');
  return path.join(
    process.env.PLATFORM_DATA_DIR ?? path.join(process.cwd(), 'data'),
    'knowledge-files',
    `${id}.bin`,
  );
}

// One JSON record per source keeps this small corpus portable across the existing
// SQLite and JSONL deployments. Credentials are never part of the stored record.
export async function documentStore() {
  const client = await getPlatformClient();
  if (client.driver === 'sqlite') {
    client.database.exec(
      'CREATE TABLE IF NOT EXISTS knowledge_documents (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL)',
    );
    return {
      list: () =>
        (
          client.database.prepare('SELECT payload_json FROM knowledge_documents').all() as {
            payload_json: string;
          }[]
        ).map((row) => JSON.parse(row.payload_json) as ManagedKnowledgeDocument),
      put: (doc: ManagedKnowledgeDocument) => {
        client.database
          .prepare(
            'INSERT INTO knowledge_documents (id, payload_json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json',
          )
          .run(doc.id, JSON.stringify(doc));
      },
      delete: (id: string) => {
        client.database.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(id);
      },
    };
  }
  const file = path.join(client.directory, 'knowledge_documents.json');
  const list = (): ManagedKnowledgeDocument[] => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as ManagedKnowledgeDocument[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  };
  const write = (docs: ManagedKnowledgeDocument[]) => {
    fs.mkdirSync(client.directory, { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(docs));
    fs.renameSync(`${file}.tmp`, file);
  };
  return {
    list,
    put: (doc: ManagedKnowledgeDocument) =>
      write([...list().filter((row) => row.id !== doc.id), doc]),
    delete: (id: string) => write(list().filter((row) => row.id !== id)),
  };
}

export async function getKnowledgeDocument(id: string) {
  return (await documentStore()).list().find((doc) => doc.id === id);
}

export async function saveKnowledgeDocument(doc: ManagedKnowledgeDocument) {
  doc.updatedAt = Date.now();
  (await documentStore()).put(doc);
}
