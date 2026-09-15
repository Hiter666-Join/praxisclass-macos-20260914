'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { trainingFetch } from '@/lib/platform/training/client';
import { uploadWorkbenchMaterial } from '@/lib/workbench/session-store';
import { useSettingsMode } from '@/lib/store/settings-mode';
import { ExtraCaseLauncher } from './extra-case-launcher';
import { EXTRA_CASES, type ExtraCaseId } from '@/lib/training/case-catalog';

const RECEIPT_KEY = 'praxis:main-ticket-preparation';
type Preparation = { requestId: string; materials: { sourceId: string; materialRef: string }[] };

export function MainCaseLauncher() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (params.get('trainingTask')) return null;
  async function prepare(fresh = false) {
    setBusy(true);
    setMessage('正在准备本次需要的资料…');
    try {
      useSettingsMode.getState().setMode('teacher');
      const catalog = await trainingFetch<{
        files: { sourceId: string; filename: string; text: string }[];
      }>('cases/main-ticket/materials', 'teacher');
      let receipt: Preparation = { requestId: crypto.randomUUID(), materials: [] };
      const saved = localStorage.getItem(RECEIPT_KEY);
      if (saved && !fresh) receipt = JSON.parse(saved) as Preparation;
      localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
      for (const file of catalog.files) {
        if (receipt.materials.some((material) => material.sourceId === file.sourceId)) continue;
        setMessage(`正在上传 ${file.filename}…`);
        const uploaded = await uploadWorkbenchMaterial(
          new File([file.text], file.filename, { type: 'text/markdown' }),
        );
        receipt.materials.push({ sourceId: file.sourceId, materialRef: uploaded.materialId });
        localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
      }
      setMessage('资料已上传，正在接入两段课堂与本次实训…');
      const result = await trainingFetch<{ taskId: string }>(
        'cases/main-ticket/initialize',
        'teacher',
        receipt,
      );
      router.push(`/teacher?trainingTask=${result.taskId}&trainingDemo=1`);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
    <section className="workspace-panel mb-6 space-y-3 p-5" aria-label="主案例演示入口">
      <h2 className="text-lg font-semibold">从一次请求到一个可信回答</h2>
      <p className="text-sm leading-7 text-muted-foreground">
        使用已准备的请求响应图解、资料核验互动和八份正文，完成 A/B
        两份成果。进入后可以调整学情和教学支持。
      </p>
      <Button disabled={busy} onClick={() => void prepare()}>
        {busy ? '正在准备…' : '准备或继续主案例体验'}
      </Button>
      <Button className="ml-2" variant="outline" disabled={busy} onClick={() => void prepare(true)}>
        创建新的演练任务
      </Button>
      <p className="text-xs leading-6 text-muted-foreground">新任务重新准备教学资料，成果从零开始。原任务和成果仍保留在课程中；模型服务沿用当前端自己的设置。</p>
      {message && (
        <p role="status" className="text-sm leading-7">
          {message}
        </p>
      )}
    </section>
    {(Object.keys(EXTRA_CASES) as ExtraCaseId[]).map((caseId) => <ExtraCaseLauncher key={caseId} caseId={caseId} />)}
    </>
  );
}
