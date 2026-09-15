'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { uploadWorkbenchMaterial } from '@/lib/workbench/session-store';
import { trainingFetch } from '@/lib/platform/training/client';
import type { TeachingPlan } from '@/lib/platform/training/contracts';

export function TaskSourceEditor({
  sources,
  onChange,
}: {
  sources: TeachingPlan['sources'];
  onChange: (sources: TeachingPlan['sources']) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(files: File[]) {
    setBusy(true);
    setError('');
    let current = sources;
    try {
      for (const file of files) {
        if (!/\.(md|markdown|txt)$/i.test(file.name))
          throw new Error('请选择 Markdown 或文本正文。');
        const content = await file.text();
        if (!content.trim() || content.length > 12000)
          throw new Error(`${file.name}：请选择不超过 12000 字符的任务正文或片段。`);
        const normalized = new File([file], file.name, {
          type: /\.txt$/i.test(file.name) ? 'text/plain' : 'text/markdown',
        });
        const material = await uploadWorkbenchMaterial(normalized);
        current = [
          ...current,
          {
            sourceId: `source-${crypto.randomUUID()}`,
            kind: 'upload',
            title: file.name,
            materialRef: material.materialId,
            locator: file.name,
            excerpt: content,
            basisType: 'teaching',
            studentVisible: false,
          },
        ];
        onChange(current);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-medium">本次使用的资料</legend>
      <p className="text-sm text-muted-foreground">
        直接选择本次需要的文件。教师参考默认仅教师可见；学生所需正文请勾选后应用。
      </p>
      <label className="block space-y-2 text-sm">
        添加 Markdown 或文本资料
        <Input
          type="file"
          accept=".md,.markdown,.txt"
          multiple
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length) void upload(files);
          }}
        />
      </label>
      {busy && (
        <p role="status" className="text-sm">
          正在上传所选资料…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {sources.map((source, index) => (
        <div
          key={source.sourceId}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"
        >
          <span className="min-w-0 break-words text-sm">{source.title}</span>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={source.studentVisible}
              onCheckedChange={(checked) =>
                onChange(
                  sources.map((item, i) =>
                    i === index ? { ...item, studentVisible: checked === true } : item,
                  ),
                )
              }
            />
            学生可见
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(sources.filter((_, i) => i !== index))}
          >
            取消选用
          </Button>
        </div>
      ))}
    </fieldset>
  );
}

export function TaskSourceViewer({
  taskId,
  revision,
  sources,
  role,
}: {
  taskId: string;
  revision: number;
  sources: TeachingPlan['sources'];
  role: 'teacher' | 'student';
}) {
  const [opened, setOpened] = useState<{ title: string; text: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!sources.length) return null;
  async function read(sourceId: string) {
    setBusy(true);
    setError('');
    setOpened(null);
    try {
      setOpened(
        await trainingFetch(`tasks/${taskId}/sources/${sourceId}?revision=${revision}`, role),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3" aria-label="本次资料与依据">
      <h5 className="font-medium">本次资料与依据</h5>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <Button
            key={source.sourceId}
            variant="outline"
            size="sm"
            className="h-auto whitespace-normal text-left"
            disabled={busy}
            onClick={() => void read(source.sourceId)}
          >
            {source.title}
          </Button>
        ))}
      </div>
      {busy && (
        <p role="status" className="text-sm">
          正在读取所选原文…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {opened && (
        <section
          aria-label="所选资料原文"
          className="space-y-2 rounded-xl border border-border p-4"
        >
          <h6 className="font-medium">{opened.title}</h6>
          <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-7">
            {opened.text}
          </pre>
          <Button variant="ghost" size="sm" onClick={() => setOpened(null)}>
            收起原文
          </Button>
        </section>
      )}
    </section>
  );
}
