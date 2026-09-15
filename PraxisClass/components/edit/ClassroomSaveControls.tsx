'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStageStore } from '@/lib/store/stage';
import { useStageSaveStatus } from '@/lib/store/stage-save-status';
import { useDeferredEditStatus } from '@/lib/edit/use-deferred-edit-status';
import {
  hasUnsavedClassroomEdits,
  saveClassroomEdits,
  useClassroomDrafts,
} from '@/lib/edit/classroom-save';

export function ClassroomSaveControls({ onExit }: { onExit: () => void }) {
  const stageId = useStageStore((state) => state.stage?.id);
  const status = useStageSaveStatus();
  const fieldDirty = useDeferredEditStatus(
    (state) => !!stageId && Object.values(state.fields).includes(stageId),
  );
  const draftDirty = useClassroomDrafts((state) =>
    Object.keys(state.drafts).some((key) => key.startsWith(`${stageId}/`)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = status.stageId === stageId;
  const saving = busy || (current && status.saving);
  const failed = !!error || (current && status.failed);
  const dirty = draftDirty || fieldDirty || (current && status.dirty);

  async function save(exit = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await saveClassroomEdits();
      if (exit) onExit();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedClassroomEdits()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', keyboard);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('keydown', keyboard);
    };
  });

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="课程保存">
      <span
        role={failed ? 'alert' : 'status'}
        title={error || undefined}
        className="max-w-64 text-xs text-muted-foreground"
      >
        {saving
          ? '正在保存…'
          : failed
            ? error || '保存失败，请重试'
            : dirty
              ? '有未保存的修改'
              : '已保存'}
      </span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void save()}>
        <Save className="size-4" />
        保存
      </Button>
      <Button size="sm" disabled={busy} onClick={() => void save(true)}>
        保存并退出编辑
      </Button>
    </div>
  );
}
