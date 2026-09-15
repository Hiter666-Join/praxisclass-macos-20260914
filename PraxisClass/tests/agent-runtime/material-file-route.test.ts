import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ session: vi.fn(), material: vi.fn(), raw: vi.fn(), ready: vi.fn(), get: vi.fn(), remove: vi.fn(), query: vi.fn() }));
vi.mock('@/lib/config/feature-flags', () => ({ isAgentRuntimeConfigured: () => true }));
vi.mock('@/lib/server/agent-runtime/with-owner', () => ({ withRequestOwnerId: (_req: unknown, run: (owner: string, headers: Headers) => unknown) => run('current-owner', new Headers()) }));
vi.mock('@/lib/server/agent-runtime/session-materials', () => ({ resolveOwnedSession: mocks.session, getSessionMaterial: mocks.material, resolveSessionMaterialRawAsset: mocks.raw }));
vi.mock('@/lib/persistence/owner-materials', () => ({ getReadyOwnerMaterials: mocks.ready }));
vi.mock('@/lib/persistence/server-provider', () => ({ getServerPersistenceProvider: async () => ({ pool: { query: mocks.query } }) }));
vi.mock('@/lib/server/materials/bytes', () => ({ getMaterialByteStore: () => ({ get: mocks.get, delete: mocks.remove }) }));
import { GET, DELETE } from '@/app/api/materials/[id]/file/route';

const params = { params: Promise.resolve({ id: 'material-1' }) };
beforeEach(() => { vi.resetAllMocks(); });
describe('original file access', () => {
  it('refuses another session before looking up or resolving a file', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(new NextRequest('http://localhost/api/materials/material-1/file?sessionId=foreign'), params)).status).toBe(404);
    expect(mocks.material).not.toHaveBeenCalled();
    expect(mocks.raw).not.toHaveBeenCalled();
  });
  it('downloads the owned source bytes with an encoded filename', async () => {
    mocks.session.mockResolvedValue({ id: 'owned' });
    mocks.material.mockResolvedValue({ kind: 'source', rawAssetId: 'private-key', title: '中文.pdf' });
    mocks.raw.mockResolvedValue({ bytes: Buffer.from('%PDF'), mime: 'application/pdf' });
    const response = await GET(new NextRequest('http://localhost/api/materials/material-1/file?sessionId=owned&download=1'), params);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('%PDF');
    expect(response.headers.get('content-disposition')).toContain(encodeURIComponent('中文.pdf'));
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('uses the current owner for imported files and refuses foreign deletion', async () => {
    mocks.ready.mockResolvedValue([]);
    const request = new NextRequest('http://localhost/api/materials/material-1/file');
    expect((await GET(request, params)).status).toBe(404);
    expect((await DELETE(request, params)).status).toBe(404);
    expect(mocks.ready).toHaveBeenCalledWith(expect.anything(), 'current-owner', ['material-1']);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
