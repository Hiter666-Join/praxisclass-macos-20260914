import type { KnowledgeEntryRow } from '@/lib/platform/db/types';

export type KnowledgeEntry = KnowledgeEntryRow;

export interface NormalizedItem {
  title: string;
  content: string;
  source: string;
  stage: string;
  score: number;
  documentId?: string;
  sourceUrl?: string;
}

export interface KnowledgeQueryResult {
  items: NormalizedItem[];
  source: 'dify';
}

export interface DifyCredentials {
  baseUrl: string;
  datasetId: string;
  apiKey: string;
}

export interface DifyDocumentList {
  name: string;
  total: number;
  documents: {
    id: string;
    name: string;
    indexingStatus: string;
    available: boolean;
    disabled: boolean;
  }[];
}
