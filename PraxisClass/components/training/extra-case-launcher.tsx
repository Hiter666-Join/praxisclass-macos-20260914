'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { trainingFetch } from '@/lib/platform/training/client';
import { uploadWorkbenchMaterial } from '@/lib/workbench/session-store';
import { useSettingsMode } from '@/lib/store/settings-mode';
import { EXTRA_CASES, type ExtraCaseId } from '@/lib/training/case-catalog';

export function ExtraCaseLauncher({ caseId }: { caseId: ExtraCaseId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const info = EXTRA_CASES[caseId];
  async function prepare(fresh = false) {
    setBusy(true);
    setMessage('正在读取本案例需要的资料…');
    try {
      useSettingsMode.getState().setMode('teacher');
      const catalog = await trainingFetch<{ files: { sourceId: string; filename: string; text: string }[] }>(`cases/${caseId}/materials`, 'teacher');
      const key = `praxis:${caseId}:preparation`;
      const raw = fresh ? null : localStorage.getItem(key);
      const receipt: { requestId: string; materials: { sourceId: string; materialRef: string }[] } = raw ? JSON.parse(raw) : { requestId: crypto.randomUUID(), materials: [] };
      localStorage.setItem(key, JSON.stringify(receipt));
      for (const file of catalog.files) {
        if (receipt.materials.some((item) => item.sourceId === file.sourceId)) continue;
        setMessage(`正在上传 ${file.filename}…`);
        const uploaded = await uploadWorkbenchMaterial(new File([file.text], file.filename, { type: 'text/markdown' }));
        receipt.materials.push({ sourceId: file.sourceId, materialRef: uploaded.materialId });
        localStorage.setItem(key, JSON.stringify(receipt));
      }
      setMessage('资料已上传，正在准备本次实训…');
      const result = await trainingFetch<{ taskId: string }>(`cases/${caseId}/initialize`, 'teacher', receipt);
      router.push(`/teacher?trainingTask=${result.taskId}&trainingDemo=1`);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="workspace-panel mb-6 space-y-3 p-5" aria-label={`${info.title}入口`}>
    <h2 className="text-lg font-semibold">{info.title}</h2>
    <p className="text-sm leading-7 text-muted-foreground">{info.description}</p>
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => void prepare()}>{busy ? '正在准备…' : '准备或继续本案例'}</Button>
      <Button variant="outline" disabled={busy} onClick={() => void prepare(true)}>创建本案例的新任务</Button>
    </div>
    <p className="text-xs leading-6 text-muted-foreground">复用教学资料，新任务成果从零开始。原任务与成果保留，师生分别使用当前端设置。</p>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
