'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/platform/page-header';
import { useRecentCourses } from '@/components/platform/recent-courses';
import { useLearnerKey } from '@/components/platform/use-learner-key';
import { useDashboard } from '@/components/platform/use-dashboard-data';
import { FeedbackForm } from '@/components/forms/feedback-form';
import { FeedbackRecords } from '@/components/dashboard/feedback-records';
import { SelectField } from '@/components/ui/select';
import { learnerSessionSchema } from '@/lib/platform/forms/schemas';
import { useI18n } from '@/lib/hooks/use-i18n';

function FeedbackPageContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { courses, loading } = useRecentCourses();
  const learnerKey = useLearnerKey();
  const { data, refresh, error } = useDashboard('self');
  const [selected, setSelected] = useState(searchParams.get('course') ?? '');
  const [formVersion, setFormVersion] = useState(0);
  const course = courses.find((item) => item.id === selected) ?? courses[0];
  const names = Object.fromEntries(courses.map((item) => [item.id, item.name]));
  return (
    <>
      <PageHeader
        title={t('studentLearning.feedback')}
        description={t('studentLearning.feedbackHint')}
      />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="workspace-panel space-y-6 p-6">
          {loading || !learnerKey ? (
            <p role="status">{t('common.loading')}</p>
          ) : !course ? (
            <p>{t('studentLearning.noCourse')}</p>
          ) : (
            <>
              <SelectField
                aria-label={t('studentLearning.chooseCourse')}
                value={course.id}
                onValueChange={setSelected}
                options={courses.map((item) => ({ value: item.id, label: item.name }))}
              />
              <FeedbackForm
                key={`${learnerKey}:${course.id}:${formVersion}`}
                schema={learnerSessionSchema}
                subjectId={learnerKey}
                courseId={course.id}
                stageId={course.id}
                title={course.name}
                onSubmitted={() => {
                  refresh();
                  setFormVersion((value) => value + 1);
                }}
              />
            </>
          )}
        </section>
        <section className="workspace-panel space-y-5 p-6">
          <h2 className="text-lg font-semibold">{t('studentLearning.myFeedback')}</h2>
          {error ? (
            <p role="alert">{t('platform.design.dashboardError')}</p>
          ) : (
            <FeedbackRecords rows={data?.feedbackEntries ?? []} courseNames={names} />
          )}
        </section>
      </div>
    </>
  );
}

export default function StudentFeedbackPage() {
  return (
    <Suspense>
      <FeedbackPageContent />
    </Suspense>
  );
}
