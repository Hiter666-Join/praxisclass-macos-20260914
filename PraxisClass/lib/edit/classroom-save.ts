import { create } from 'zustand';
import { toast } from 'sonner';
import { flushStageSave, hasPendingStageSave, useStageStore } from '@/lib/store/stage';
import { hasDeferredEdits } from '@/lib/edit/use-deferred-edit-status';

export type InteractiveDraft = { html: string; url: string };
const draftKey = (stageId: string, sceneId: string) => `${stageId}/${sceneId}`;

// Kept outside the surface so navigation among pages does not discard a draft.
export const useClassroomDrafts = create<{
  drafts: Record<string, InteractiveDraft>;
  setDraft: (stageId: string, sceneId: string, draft: InteractiveDraft) => void;
}>((set) => ({
  drafts: {},
  setDraft: (stageId, sceneId, draft) =>
    set((state) => ({
      drafts: { ...state.drafts, [draftKey(stageId, sceneId)]: draft },
    })),
}));

export function getInteractiveDraft(stageId: string, sceneId: string) {
  return useClassroomDrafts.getState().drafts[draftKey(stageId, sceneId)];
}

export function hasClassroomDrafts(stageId: string): boolean {
  return Object.keys(useClassroomDrafts.getState().drafts).some((key) =>
    key.startsWith(`${stageId}/`),
  );
}

export function hasUnsavedClassroomEdits(): boolean {
  const stageId = useStageStore.getState().stage?.id;
  return (
    !!stageId &&
    (hasPendingStageSave(stageId) || hasClassroomDrafts(stageId) || hasDeferredEdits(stageId))
  );
}

export async function saveClassroomEdits(): Promise<void> {
  // Text controls that commit on blur must finish before the persistence snapshot.
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  const state = useStageStore.getState();
  const stageId = state.stage?.id;
  if (!stageId) return;
  const entries = Object.entries(useClassroomDrafts.getState().drafts).filter(([key]) =>
    key.startsWith(`${stageId}/`),
  );
  if (entries.length && (!state.isOwner || state.readOnly)) {
    throw new Error('当前课堂不可编辑，草稿已保留。');
  }
  // Validate every page first so an invalid draft does not partially commit others.
  const updates = entries.map(([key, draft]) => {
    const scene = state.scenes.find((item) => draftKey(stageId, item.id) === key);
    if (!scene) return null; // A deleted page is intentionally absent from the course.
    if (scene.content.type !== 'interactive') throw new Error('页面类型已改变，请重新检查草稿。');
    if (!draft.html.trim() && !draft.url.trim())
      throw new Error(`“${scene.title}”需要页面内容或地址。`);
    return { scene, content: { ...scene.content, html: draft.html, url: draft.url.trim() } };
  });
  for (const update of updates) {
    if (update) state.updateScene(update.scene.id, { content: update.content });
  }
  await flushStageSave();
  if (useStageStore.getState().stage?.id !== stageId || hasPendingStageSave(stageId)) {
    throw new Error('修改尚未全部保存成功，请重试保存。');
  }
  // A later edit made while saving must survive this save's acknowledgement.
  useClassroomDrafts.setState((current) => {
    const drafts = { ...current.drafts };
    for (const [key, draft] of entries) if (drafts[key] === draft) delete drafts[key];
    return { drafts };
  });
  if (hasClassroomDrafts(stageId)) throw new Error('保存期间有新的修改，请再次保存。');
}

export async function saveBeforeLeaving(leave: () => void): Promise<void> {
  try {
    await saveClassroomEdits();
    leave();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '保存失败，修改已保留，请重试。');
  }
}
