import type { AppDocumentOutline } from '@/lib/document-store/persistence-types';
import { bindOwnerMaterialsToSession } from './session-materials';

/** Called only after the runtime has confirmed ownership of the attached course. */
export async function bindImportedCourseMaterials(
  sessionId: string,
  ownerId: string,
  outline: AppDocumentOutline | undefined,
): Promise<void> {
  if (!outline?.sourceMaterials?.length) return;
  const ids = [...new Set(outline.sourceMaterials.map((source) => source.materialId))];
  if (ids.some((id) => typeof id !== 'string' || !id)) throw new Error('课程原件引用无效');
  await bindOwnerMaterialsToSession(sessionId, ownerId, ids);
}
