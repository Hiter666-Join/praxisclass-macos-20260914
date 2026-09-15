'use client';

import { ScheduleList } from '@/components/platform/schedule-list';
import { useI18n } from '@/lib/hooks/use-i18n';

export function ScheduleSettings() {
  const { t } = useI18n();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('settings.schedule.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.schedule.description')}</p>
      </div>
      <ScheduleList />
    </div>
  );
}
