import { describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/platform/knowledge/documents/route';
import { documentStore } from '@/lib/platform/knowledge/documents/store';
import { enqueueKnowledgeJob } from '@/lib/platform/knowledge/documents/jobs';

vi.mock('@/lib/platform/knowledge/documents/store', () => ({
  documentStore: vi.fn(() => {
    throw new Error('Existing documents must not be opened');
  }),
}));
vi.mock('@/lib/platform/knowledge/documents/jobs', () => ({
  enqueueKnowledgeJob: vi.fn(() => {
    throw new Error('Retired uploads must not schedule work');
  }),
}));

describe('retired local document API', () => {
  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)(
    'returns 410 for %s without reading files or scheduling parsing and sync',
    async (_method, handler) => {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({ error: 'local_knowledge_removed' });
      expect(documentStore).not.toHaveBeenCalled();
      expect(enqueueKnowledgeJob).not.toHaveBeenCalled();
    },
  );
});
