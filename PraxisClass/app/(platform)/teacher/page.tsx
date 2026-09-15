'use client';

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  ChartNoAxesCombined,
  MessageSquare,
  PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select';
import { PageHeader } from '@/components/platform/page-header';
import { NextClassBanner } from '@/components/platform/next-class-banner';
import { useRecentCourses } from '@/components/platform/recent-courses';
import { CourseWorkbench, type WorkbenchCourse } from '@/components/platform/course-workbench';
import { WorkspaceDrawer } from '@/components/platform/workspace-drawer';
import { ScheduleList } from '@/components/platform/schedule-list';
import { useDashboard } from '@/components/platform/use-dashboard-data';
import { FeedbackForm } from '@/components/forms/feedback-form';
import { matchCourseStats } from '@/components/platform/course-card';
import { teacherPostClassSchema } from '@/lib/platform/forms/schemas';
import { useI18n } from '@/lib/hooks/use-i18n';
import { TrainingTaskEntry } from '@/components/training/task-panel';

const VersionTrendChart = dynamic(
  () =>
    import('@/components/dashboard/version-trend-chart').then((module) => module.VersionTrendChart),
  { ssr: false },
);

export default function TeacherHomePage() {
  const { t } = useI18n();
  const { data, refresh } = useDashboard('all');
  const { courses, loading } = useRecentCourses();
  const [tool, setTool] = useState<'schedule' | 'feedback' | 'trend' | null>(null);
  const [feedbackCourse, setFeedbackCourse] = useState('');
  const activeCourse = courses.find((course) => course.id === feedbackCourse);
  const trend = data?.versionTrend ?? [];
  const openFeedback = (course?: WorkbenchCourse) => {
    setFeedbackCourse(course?.id ?? '');
    setTool('feedback');
  };
  const newCourse = (
    <Button asChild className="h-11 gap-2 rounded-xl px-4">
      <Link href="/">
        <PenLine className="size-4" />
        {t('platform.design.newCourse')}
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title={t('platform.pages.teacher.title')}
        actions={
          <>
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-xl px-4"
              onClick={() => setTool('schedule')}
              aria-haspopup="dialog"
            >
              <CalendarClock className="size-4" />
              {t('platform.nav.schedule')}
            </Button>
            {newCourse}
          </>
        }
      />
      <Suspense fallback={null}><TrainingTaskEntry role="teacher" /></Suspense>
      <dl className="mb-6 flex flex-wrap gap-x-8 gap-y-3 border-b border-border pb-5">
        {[
          [t('platform.teacher.statCourses'), loading ? '—' : String(courses.length)],
          [t('platform.teacher.statSessions'), data ? String(data.overview.learnerSessions) : '—'],
          [t('platform.teacher.statFeedback'), data ? String(data.overview.feedbackCount) : '—'],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2.5">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <CourseWorkbench
          courses={courses}
          loading={loading}
          dashboard={data}
          emptyAction={newCourse}
          onFeedback={openFeedback}
        />
        <aside className="workspace-panel workspace-glass-card overflow-hidden">
          <section className="border-b border-border p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <CalendarClock className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">{t('platform.banner.nextClass')}</h2>
            </div>
            <NextClassBanner />
            <Button
              variant="outline"
              className="mt-4 h-11 w-full justify-between rounded-xl px-3"
              onClick={() => setTool('schedule')}
              aria-haspopup="dialog"
            >
              {t('platform.design.courseSchedule')}
              <ArrowRight className="size-4" />
            </Button>
          </section>
          <section className="p-3">
            <h2 className="px-2 pb-2 pt-1 text-sm font-semibold">
              {t('platform.workbench.quickActions')}
            </h2>
            <Button
              variant="ghost"
              onClick={() => openFeedback()}
              className="h-12 w-full justify-start gap-3 rounded-xl px-3"
              aria-haspopup="dialog"
            >
              <MessageSquare className="size-5" />
              {t('platform.teacher.postClassFeedback')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setTool('trend')}
              className="h-12 w-full justify-start gap-3 rounded-xl px-3"
              aria-haspopup="dialog"
            >
              <ChartNoAxesCombined className="size-5" />
              {t('platform.teacher.feedbackTrend')}
            </Button>
          </section>
        </aside>
      </div>
      <WorkspaceDrawer
        open={tool !== null}
        onOpenChange={(open) => {
          if (!open) setTool(null);
        }}
        title={t(
          tool === 'schedule'
            ? 'platform.nav.schedule'
            : tool === 'trend'
              ? 'platform.teacher.feedbackTrend'
              : 'platform.teacher.postClassFeedback',
        )}
      >
        {tool === 'schedule' && <ScheduleList />}
        {tool === 'trend' && (
          <div className="space-y-5">
            {trend.length ? (
              <VersionTrendChart rows={trend} compact />
            ) : (
              <p className="text-base leading-7 text-muted-foreground">
                {t('platform.empty.trend')}
              </p>
            )}
            <Button
              variant="outline"
              asChild
              className="h-11 w-full justify-between rounded-xl px-4"
            >
              <Link href="/dashboard">
                {t('platform.nav.dashboard')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        )}
        {tool === 'feedback' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="feedback-course" className="block text-sm font-medium leading-6">
                {t('platform.teacher.selectCourse')}
              </label>
              <SelectField
                id="feedback-course"
                value={feedbackCourse}
                onValueChange={setFeedbackCourse}
                options={[
                  { value: '', label: t('platform.teacher.selectCourse') },
                  ...courses.map((course) => ({ value: course.id, label: course.name })),
                ]}
              />
            </div>
            {activeCourse ? (
              <FeedbackForm
                key={activeCourse.id}
                schema={teacherPostClassSchema}
                subjectId="teacher:main"
                courseId={
                  data?.courseCatalog?.find((row) => row.stage_id === activeCourse.id)?.course_id ??
                  activeCourse.id
                }
                courseVersion={matchCourseStats(data, activeCourse.id).version ?? undefined}
                stageId={activeCourse.id}
                title={activeCourse.name}
                onSubmitted={() => {
                  refresh();
                  setTool(null);
                }}
              />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="mb-4 text-sm leading-6 text-muted-foreground">
                  {t(
                    courses.length
                      ? 'platform.teacher.selectCourse'
                      : 'platform.workbench.createHint',
                  )}
                </p>
                {courses.length === 0 && newCourse}
              </div>
            )}
          </div>
        )}
      </WorkspaceDrawer>
    </>
  );
}
