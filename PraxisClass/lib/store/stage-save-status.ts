import { create } from 'zustand';

/** Transient persistence state; never written into the classroom document. */
export const useStageSaveStatus = create<{
  stageId: string | null;
  dirty: boolean;
  saving: boolean;
  failed: boolean;
}>(() => ({ stageId: null, dirty: false, saving: false, failed: false }));
