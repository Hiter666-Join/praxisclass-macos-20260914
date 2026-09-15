'use client';

import { StudentLearningDashboard } from '@/components/dashboard/student-learning-dashboard';
import { PageHeader } from '@/components/platform/page-header';
import { useI18n } from '@/lib/hooks/use-i18n';

export default function StudentDashboardPage() {
  const { t } = useI18n();

  return (
    <>
      <PageHeader
        title={t('platform.pages.studentDashboard.title')}
        description={t('platform.pages.studentDashboard.description')}
      />
      <StudentLearningDashboard />
    </>
  );
}
