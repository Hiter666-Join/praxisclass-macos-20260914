'use client';

import { useI18n } from '@/lib/hooks/use-i18n';

interface EmptyChartProps {
  message?: string;
  hint?: string;
  height?: number;
}

export function EmptyChart({ message, hint, height = 160 }: EmptyChartProps) {
  const { t } = useI18n();

  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center"
      style={{ minHeight: height }}
    >
      <p className="text-base font-medium leading-6 text-foreground">
        {message ?? t('platform.dashboard.empty.data')}
      </p>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        {hint ?? t('platform.dashboard.empty.hint')}
      </p>
    </div>
  );
}
