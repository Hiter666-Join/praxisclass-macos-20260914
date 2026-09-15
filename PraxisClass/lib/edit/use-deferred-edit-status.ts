'use client';

import { useId, useLayoutEffect } from 'react';
import { create } from 'zustand';
import { useStageStore } from '@/lib/store/stage';

// Text fields that commit on blur still count as unsaved while being typed.
export const useDeferredEditStatus = create<{ fields: Record<string, string> }>(() => ({
  fields: {},
}));

export function hasDeferredEdits(stageId: string) {
  return Object.values(useDeferredEditStatus.getState().fields).includes(stageId);
}

export function useDeferredEdit(dirty: boolean) {
  const id = useId();
  const stageId = useStageStore((state) => state.stage?.id);
  useLayoutEffect(() => {
    if (!dirty || !stageId) return;
    useDeferredEditStatus.setState((state) => ({ fields: { ...state.fields, [id]: stageId } }));
    return () => {
      useDeferredEditStatus.setState((state) => {
        const fields = { ...state.fields };
        delete fields[id];
        return { fields };
      });
    };
  }, [dirty, id, stageId]);
}
