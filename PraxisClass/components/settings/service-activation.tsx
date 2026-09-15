'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/lib/store/settings';
import type { ProviderId } from '@/lib/ai/providers';
import { IMAGE_PROVIDERS } from '@/lib/media/image-providers';
import { VIDEO_PROVIDERS } from '@/lib/media/video-providers';
import type { ImageProviderId, VideoProviderId } from '@/lib/media/types';
import {
  activateService,
  currentServiceProvider,
  disableService,
  serviceConfigurationIssue,
  serviceEnabled,
  type ServiceSection,
} from '@/lib/settings/service-activation';

export function ServiceActivation({
  section,
  providerId,
}: {
  section: ServiceSection;
  providerId: string;
}) {
  const s = useSettingsStore();
  const [choice, setChoice] = useState('');
  const [error, setError] = useState('');
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (section !== 'image' || providerId !== 'comfyui-image') return;
    let cancelled = false;
    fetch('/api/comfyui-workflows')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setWorkflows(data.workflows ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('无法读取 ComfyUI 工作流，请重试。');
      });
    return () => {
      cancelled = true;
    };
  }, [section, providerId]);
  const cfg =
    section === 'image'
      ? s.imageProvidersConfig[providerId as ImageProviderId]
      : section === 'video'
        ? s.videoProvidersConfig[providerId as VideoProviderId]
        : undefined;
  const builtIn =
    section === 'image'
      ? IMAGE_PROVIDERS[providerId as ImageProviderId]?.models
      : section === 'video'
        ? VIDEO_PROVIDERS[providerId as VideoProviderId]?.models
        : undefined;
  const custom = cfg?.customModels ?? [];
  const models =
    section === 'providers'
      ? (s.providersConfig[providerId as ProviderId]?.models ?? [])
      : providerId === 'comfyui-image'
        ? workflows
        : cfg?.replaceBuiltInModels && custom.length
          ? custom
          : [...(builtIn ?? []), ...custom];
  const currentId = currentServiceProvider(s, section);
  const currentModel =
    section === 'providers'
      ? s.modelId
      : section === 'image'
        ? s.imageModelId
        : section === 'video'
          ? s.videoModelId
          : '';
  const selected =
    models.find((m) => m.id === choice)?.id ??
    (currentId === providerId && models.some((m) => m.id === currentModel)
      ? currentModel
      : (models[0]?.id ?? ''));
  const active = currentId === providerId && serviceEnabled(s, section);
  const issue = serviceConfigurationIssue(s, section, providerId);
  const needsModel = ['providers', 'image', 'video'].includes(section);
  return (
    <div className="mb-5 space-y-3 rounded-xl border bg-muted/20 p-4" aria-label="服务启用设置">
      <p className="text-sm">
        {s.mode === 'teacher' ? '教师端' : '学生端'}当前服务：{currentId || '未选择'}
        {currentModel ? ` / ${currentModel}` : ''} ·{' '}
        {serviceEnabled(s, section) ? '已启用' : '未启用'}
      </p>
      {needsModel && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          使用模型
          <select
            aria-label="使用模型"
            value={selected}
            onChange={(e) => setChoice(e.target.value)}
            className="min-w-0 flex-1 rounded-md border bg-background p-2"
          >
            {!models.length && <option value="">请先配置模型或工作流</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!!issue || (needsModel && !selected)}
          onClick={() => {
            try {
              activateService(useSettingsStore.getState(), section, providerId, selected);
              setError('');
            } catch (err) {
              setError(err instanceof Error ? err.message : '启用失败');
            }
          }}
        >
          {active || section === 'providers' || section === 'pdf' ? '使用此服务' : '启用并使用此服务'}
        </Button>
        {active && !['providers', 'pdf'].includes(section) && (
          <Button size="sm" variant="outline" onClick={() => disableService(s, section)}>
            关闭功能
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {issue || '配置在本端保存，启用后可直接在当前页面使用。实际连接情况可通过下方测试确认。'}
      </p>
      {section === 'tts' && (
        <p className="text-xs text-muted-foreground">
          已有课程缺少讲解音频时，可在编辑页的讲解工具中生成语音。
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
