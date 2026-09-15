import type { NextRequest } from 'next/server';
import { isAgentRuntimeConfigured } from '@/lib/config/feature-flags';
import { withRequestOwnerId } from '@/lib/server/agent-runtime/with-owner';
import { ownerNotFound } from '@/lib/server/agent-runtime/route-response';
import { getReadyOwnerMaterials } from '@/lib/persistence/owner-materials';
import { getServerPersistenceProvider } from '@/lib/persistence/server-provider';
import { getMaterialByteStore } from '@/lib/server/materials/bytes';
import {
  getSessionMaterial, resolveOwnedSession, resolveSessionMaterialRawAsset,
} from '@/lib/server/agent-runtime/session-materials';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };

/** Original bytes, authorized through the source session or the uploading owner. */
export async function GET(req: NextRequest, { params }: Params) {
  if (!isAgentRuntimeConfigured()) return new Response('Not found', { status: 404 });
  return withRequestOwnerId(req, async (ownerId, headers) => {
    const { id } = await params;
    const sessionId = new URL(req.url).searchParams.get('sessionId');
    let file: { bytes: Buffer; mime: string } | null = null;
    let name = 'material';
    if (sessionId) {
      if (!(await resolveOwnedSession(sessionId, ownerId))) return ownerNotFound(headers);
      const material = await getSessionMaterial(sessionId, id);
      if (!material?.rawAssetId || material.kind !== 'source') return ownerNotFound(headers);
      file = await resolveSessionMaterialRawAsset(sessionId, material.rawAssetId);
      name = material.title || name;
    } else {
      const provider = await getServerPersistenceProvider(process.env.DATABASE_URL ?? '');
      const [material] = await getReadyOwnerMaterials(provider.pool, ownerId, [id]);
      if (!material) return ownerNotFound(headers);
      try {
        file = { bytes: await getMaterialByteStore().get(material.ossKey), mime: material.mime || 'application/octet-stream' };
      } catch { return ownerNotFound(headers); }
      name = material.originalName || name;
    }
    if (!file) return ownerNotFound(headers);
    const responseHeaders = new Headers(headers);
    responseHeaders.set('content-type', file.mime);
    responseHeaders.set('content-length', String(file.bytes.byteLength));
    if (new URL(req.url).searchParams.get('download') === '1') {
      responseHeaders.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name).replace(/'/g, '%27')}`);
    }
    responseHeaders.set('cache-control', 'private, no-store');
    responseHeaders.set('x-content-type-options', 'nosniff');
    return new Response(new Uint8Array(file.bytes), { headers: responseHeaders });
  });
}

/** Compensate newly uploaded import files when their course could not commit. */
export async function DELETE(req: NextRequest, { params }: Params) {
  if (!isAgentRuntimeConfigured()) return new Response('Not found', { status: 404 });
  return withRequestOwnerId(req, async (ownerId, headers) => {
    const { id } = await params;
    const provider = await getServerPersistenceProvider(process.env.DATABASE_URL ?? '');
    const [material] = await getReadyOwnerMaterials(provider.pool, ownerId, [id]);
    if (!material) return ownerNotFound(headers);
    // Session bindings own separate byte copies, so compensation cannot delete them.
    await getMaterialByteStore().delete(material.ossKey);
    await provider.pool.query('UPDATE owner_material SET deleted_at = $3 WHERE id = $1 AND owner_id = $2', [id, ownerId, Date.now()]);
    return new Response(null, { status: 204, headers });
  });
}
