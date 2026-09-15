import { describe, expect, it, vi } from 'vitest';
const bind = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/agent-runtime/session-materials', () => ({ bindOwnerMaterialsToSession: bind }));
import { bindImportedCourseMaterials } from '@/lib/server/agent-runtime/imported-course-materials';
describe('imported Pro materials', () => {
  it('binds restored owner files idempotently through the existing material seam', async () => {
    const source = { materialId: 'new-file', originalName: 'a.pdf', mime: 'application/pdf', bytes: 5 };
    await bindImportedCourseMaterials('new-session', 'owner', { outlines: [], createdAt: 1, updatedAt: 1, sourceMaterials: [source, source] });
    expect(bind).toHaveBeenCalledExactlyOnceWith('new-session', 'owner', ['new-file']);
  });
});
