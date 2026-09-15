import { z } from 'zod';

export const KNOWLEDGE_LIMITS = {
  fileBytes: 15 * 1024 * 1024,
  totalBytes: 300 * 1024 * 1024,
  documents: 50,
  pages: 150,
  entries: 120,
  textChars: 240000,
};
export const knowledgeDraftSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(4000),
  location: z.string().trim().max(160),
  enabled: z.boolean(),
});
export type KnowledgeDraft = z.infer<typeof knowledgeDraftSchema>;
export type DocumentStatus =
  | 'queued'
  | 'parsing'
  | 'draft'
  | 'syncing'
  | 'indexing'
  | 'ready'
  | 'failed'
  | 'deleting';
export interface ManagedKnowledgeDocument {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  caseName: string;
  source: string;
  providerId: string;
  status: DocumentStatus;
  error: string | null;
  entries: KnowledgeDraft[];
  warnings: string[];
  revision: number;
  publishedRevision: number | null;
  remote: {
    id: string;
    batch: string;
    baseUrl: string;
    datasetId: string;
    revision: number;
  } | null;
  createdAt: number;
  updatedAt: number;
}

export const editDocumentSchema = z
  .object({
    revision: z.number().int().positive(),
    caseName: z.string().trim().min(1).max(80),
    source: z.string().trim().min(1).max(300),
    entries: z.array(knowledgeDraftSchema).min(1).max(KNOWLEDGE_LIMITS.entries),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.entries.map((entry) => entry.id)).size !== value.entries.length)
      ctx.addIssue({ code: 'custom', message: '知识条目编号重复' });
    if (
      value.entries.reduce((sum, entry) => sum + entry.content.length, 0) >
      KNOWLEDGE_LIMITS.textChars
    )
      ctx.addIssue({ code: 'custom', message: '资料文字总量过大，请拆分上传' });
  });

export function entrySource(
  doc: Pick<ManagedKnowledgeDocument, 'source'>,
  entry: KnowledgeDraft,
): string {
  return [doc.source, entry.location].filter(Boolean).join(' · ');
}
