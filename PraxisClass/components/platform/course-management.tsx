'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { deleteStageData, renameStage } from '@/lib/utils/stage-storage';

export function CourseManagement({
  id,
  name,
  onChanged,
}: {
  id: string;
  name: string;
  onChanged: () => void;
}) {
  const [action, setAction] = useState<'rename' | 'delete' | null>(null);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (action === 'rename') await renameStage(id, draft.trim());
      else if (action === 'delete') await deleteStageData(id);
      onChanged();
      setAction(null);
    } catch {
      setError('操作未完成，请重试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setDraft(name);
          setError('');
          setAction('rename');
        }}
      >
        重命名
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setError('');
          setAction('delete');
        }}
      >
        删除课程
      </Button>
      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{action === 'rename' ? '重命名课程' : '删除课程'}</DialogTitle>
          <DialogDescription>
            {action === 'rename'
              ? '修改后会保存到课程数据中。'
              : `确认删除“${name}”及其课件、课堂对话？此操作无法撤销。`}
          </DialogDescription>
          {action === 'rename' && (
            <div className="space-y-2">
              <Label htmlFor={`course-name-${id}`}>课程名称</Label>
              <Input
                id={`course-name-${id}`}
                value={draft}
                maxLength={200}
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setAction(null)}>
              取消
            </Button>
            <Button
              variant={action === 'delete' ? 'destructive' : 'default'}
              disabled={busy || (action === 'rename' && !draft.trim())}
              onClick={submit}
            >
              {busy ? '保存中…' : action === 'rename' ? '保存名称' : '确认删除课程'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
