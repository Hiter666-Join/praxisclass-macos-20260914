'use client';

import { NextClassBanner } from '@/components/platform/next-class-banner';
import { PageHeader } from '@/components/platform/page-header';
import { ScheduleList } from '@/components/platform/schedule-list';
import { useI18n } from '@/lib/hooks/use-i18n';

export default function SchedulePage() {
  const { t } = useI18n();

  return (
    <>
      <PageHeader
        title={t('platform.pages.schedule.title')}
        description={t('platform.pages.schedule.description')}
      />
      <div className="space-y-8">
        <section className="workspace-panel space-y-4 p-5 sm:p-6">
          <h2 className="text-base font-semibold">{t('platform.design.nextClass')}</h2>
          <NextClassBanner />
        </section>
        <ScheduleList />
      </div>
    </>
  );
}
