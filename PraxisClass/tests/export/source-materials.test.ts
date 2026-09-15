import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { archiveCourseSources, restoreCourseSources, removeImportedSources } from '@/lib/export/source-materials';
import type { AppDocumentOutline } from '@/lib/document-store/persistence-types';

const original = new TextEncoder().encode('%PDF-1.7\n教师资料\n');
const outline = { producerRef: 'old-session', outlines: [], createdAt: 1, updatedAt: 1 } satisfies AppDocumentOutline;

describe('portable course originals', () => {
  it('round-trips original bytes through a new server upload and re-exports with new IDs', async () => {
    const zip = new JSZip();
    const sourceFetch = vi.fn(async (url: string) => url.startsWith('/api/materials?')
      ? Response.json({ materials: [
          { materialId: 'old-id', kind: 'source', title: '中文讲义.pdf' },
          { materialId: 'extracted', kind: 'extraction' },
        ] })
      : new Response(original, { headers: { 'content-type': 'application/pdf' } }));
    const manifest = await archiveCourseSources(zip, outline, sourceFetch as typeof fetch);
    expect(manifest).toEqual([{ path: 'sources/1', name: '中文讲义.pdf', mime: 'application/pdf', bytes: original.length }]);
    expect(JSON.stringify(manifest)).not.toMatch(/old-id|old-session|localhost/);
    const loadedZip = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
    const ids: string[] = [];
    const targetFetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('/api/materials');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({ 'x-material-filename': encodeURIComponent('中文讲义.pdf') });
      expect(new Uint8Array(await (init?.body as Blob).arrayBuffer())).toEqual(original);
      return Response.json({ materialId: 'new-id', originalName: '中文讲义.pdf', mime: 'application/pdf', bytes: original.length }, { status: 201 });
    });
    const restored = await restoreCourseSources(loadedZip, manifest, ids, targetFetch as typeof fetch);
    expect(ids).toEqual(['new-id']);
    const newFetch = vi.fn(async () => new Response(original, { headers: { 'content-type': 'application/pdf' } }));
    const reexport = new JSZip();
    await archiveCourseSources(reexport, { ...outline, producerRef: undefined, sourceMaterials: restored }, newFetch);
    expect(newFetch).toHaveBeenCalledWith('/api/materials/new-id/file');
    expect(await reexport.file('sources/1')!.async('uint8array')).toEqual(original);
  });

  it('rejects a missing or unsafe source before uploading anything', async () => {
    const fetcher = vi.fn();
    for (const path of ['sources/1', '../private.pdf']) {
      await expect(restoreCourseSources(new JSZip(), [{ path, name: 'a.pdf', mime: 'application/pdf', bytes: 3 }], [], fetcher)).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fails a partial transfer and tracks only this import for cleanup', async () => {
    const zip = new JSZip().file('sources/1', original).file('sources/2', original);
    const manifest = [1, 2].map((index) => ({ path: `sources/${index}`, name: `${index}.pdf`, mime: 'application/pdf', bytes: original.length }));
    const ids: string[] = [];
    const upload = vi.fn().mockResolvedValueOnce(Response.json({ materialId: 'fresh-id' }, { status: 201 })).mockResolvedValueOnce(new Response('', { status: 413 }));
    await expect(restoreCourseSources(zip, manifest, ids, upload)).rejects.toThrow('413');
    expect(ids).toEqual(['fresh-id']);
    const cleanup = vi.fn(async () => new Response(null, { status: 204 }));
    await removeImportedSources(ids, cleanup);
    expect(cleanup).toHaveBeenCalledWith('/api/materials/fresh-id/file', { method: 'DELETE' });
  });

  it('preserves legacy archives without making a server request', async () => {
    const fetcher = vi.fn();
    expect(await archiveCourseSources(new JSZip(), undefined, fetcher)).toEqual([]);
    expect(await restoreCourseSources(new JSZip(), undefined, [], fetcher)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('refuses an empty successful response instead of producing a misleading archive', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ materials: [{ materialId: 'a', kind: 'source', title: 'a.pdf' }] })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(archiveCourseSources(new JSZip(), outline, fetcher)).rejects.toThrow('原件为空');
  });
});
