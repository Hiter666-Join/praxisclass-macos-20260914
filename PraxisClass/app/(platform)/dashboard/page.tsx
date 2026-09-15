'use client';

import { DashboardView } from '@/components/dashboard/dashboard-view';
import { PageHeader } from '@/components/platform/page-header';
import { useI18n } from '@/lib/hooks/use-i18n';

export default function DashboardPage() {
  const { t } = useI18n();

  return (
    <>
      <PageHeader
        title={t('platform.pages.dashboard.title')}
        description={t('platform.pages.dashboard.description')}
      />
      <DashboardView scope="all" />
    </>
  );
}
