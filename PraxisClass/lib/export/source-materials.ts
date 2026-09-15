import type JSZip from 'jszip';
import type { AppDocumentOutline } from '@/lib/document-store/persistence-types';
import type { ManifestSourceMaterial } from './classroom-zip-types';
import type { CourseSourceMaterial } from '@/lib/types/course-materials';

type Fetch = typeof fetch;

/** Fetch through this origin's owner-checked APIs; never serialize local URLs or IDs. */
export async function archiveCourseSources(
  zip: JSZip,
  outline: AppDocumentOutline | undefined,
  fetcher: Fetch = fetch,
): Promise<ManifestSourceMaterial[]> {
  const sources: Array<{ id: string; name: string; sessionId?: string }> = [];
  for (const source of outline?.sourceMaterials ?? []) {
    sources.push({ id: source.materialId, name: source.originalName });
  }
  if (outline?.producerRef) {
    let before: string | undefined;
    for (;;) {
      const query = new URLSearchParams({ sessionId: outline.producerRef, limit: '200' });
      if (before) query.set('before', before);
      const response = await fetcher(`/api/materials?${query}`);
      if (!response.ok) throw new Error('无法读取课程原件，请检查备课对话是否仍可访问。');
      const { materials } = await response.json() as {
        materials: Array<{ materialId: string; kind: string; title?: string }>;
      };
      for (const material of materials) {
        if (material.kind === 'source' && !sources.some((source) => source.id === material.materialId)) {
          sources.push({ id: material.materialId, name: material.title || material.materialId, sessionId: outline.producerRef });
        }
      }
      if (materials.length < 200) break;
      const cursor = materials.at(-1)!.materialId;
      if (cursor === before) throw new Error('课程资料分页未前进');
      before = cursor;
    }
  }
  const manifest: ManifestSourceMaterial[] = [];
  for (const [index, source] of sources.entries()) {
    const query = source.sessionId ? `?${new URLSearchParams({ sessionId: source.sessionId })}` : '';
    const response = await fetcher(`/api/materials/${encodeURIComponent(source.id)}/file${query}`);
    if (!response.ok) throw new Error(`无法打包课程原件：${source.name}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength) throw new Error(`课程原件为空，导出已停止：${source.name}`);
    const path = `sources/${index + 1}`;
    zip.file(path, bytes);
    manifest.push({ path, name: source.name, mime: response.headers.get('content-type') || 'application/octet-stream', bytes: bytes.byteLength });
  }
  return manifest;
}

/** Validate the complete archive before any uploads, then use the normal remote upload API. */
export async function restoreCourseSources(
  zip: JSZip,
  manifest: ManifestSourceMaterial[] | undefined,
  allocatedIds: string[],
  fetcher: Fetch = fetch,
): Promise<CourseSourceMaterial[]> {
  if (manifest === undefined) return [];
  if (!Array.isArray(manifest) || manifest.length > 200) throw new Error('Invalid course sources');
  const seen = new Set<string>();
  for (const source of manifest) {
    if (!source || typeof source.path !== 'string' || !/^sources\/[1-9]\d*$/.test(source.path) ||
      seen.has(source.path) || typeof source.name !== 'string' || !source.name.trim() ||
      typeof source.mime !== 'string' || !source.mime || !Number.isSafeInteger(source.bytes) ||
      source.bytes < 1 || !zip.file(source.path)) throw new Error('Invalid course source file');
    seen.add(source.path);
  }
  const restored: CourseSourceMaterial[] = [];
  for (const source of manifest) {
    const bytes = await zip.file(source.path)!.async('uint8array');
    if (bytes.byteLength !== source.bytes) throw new Error(`课程原件大小不符：${source.name}`);
    const response = await fetcher('/api/materials', {
      method: 'POST',
      headers: { 'content-type': source.mime, 'x-material-filename': encodeURIComponent(source.name) },
      body: new Blob([bytes as BlobPart], { type: source.mime }),
    });
    if (!response.ok) throw new Error(`课程原件上传失败：${source.name}（${response.status}）`);
    const uploaded = await response.json() as CourseSourceMaterial;
    if (!uploaded.materialId) throw new Error('Invalid material upload response');
    allocatedIds.push(uploaded.materialId);
    restored.push(uploaded);
  }
  return restored;
}

export async function removeImportedSources(ids: readonly string[], fetcher: Fetch = fetch): Promise<void> {
  for (const id of ids) {
    const response = await fetcher(`/api/materials/${encodeURIComponent(id)}/file`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) throw new Error('Failed to undo imported source');
  }
}
