'use client';
import { usePlatformMode } from '@/components/platform/nav-config';

export function ProviderScopeNote() {
  const { mode } = usePlatformMode();
  return <p className="text-sm text-muted-foreground">{mode === 'teacher' ? '教师端' : '学生端'}配置：供应商、凭据和模型仅保存在当前端，两端互不覆盖。</p>;
}
