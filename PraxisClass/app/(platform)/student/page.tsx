'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/platform/page-header';
import { CourseWorkbench } from '@/components/platform/course-workbench';
import { WorkspaceDrawer } from '@/components/platform/workspace-drawer';
import { useRecentCourses } from '@/components/platform/recent-courses';
import { useDashboard } from '@/components/platform/use-dashboard-data';
import { useI18n } from '@/lib/hooks/use-i18n';
import { TrainingTaskEntry } from '@/components/training/task-panel';

const SEED_COURSE_IDS = (process.env.NEXT_PUBLIC_STUDENT_COURSE_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

export default function StudentCoursesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { data } = useDashboard('self');
  const { courses, loading } = useRecentCourses();
  const [joinOpen, setJoinOpen] = useState(false);
  const [classroomLink, setClassroomLink] = useState('');
  const [linkError, setLinkError] = useState(false);
  const entries = [
    ...courses,
    ...SEED_COURSE_IDS.filter((id) => !courses.some((course) => course.id === id)).map((id) => ({
      id,
      name: id,
    })),
  ];
  const openClassroom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const url = new URL(classroomLink.trim(), window.location.origin);
      if (url.origin !== window.location.origin || !/^\/classroom\/[^/]+\/?$/.test(url.pathname)) {
        setLinkError(true);
        return;
      }
      setLinkError(false);
      router.push(`${url.pathname}${url.search}${url.hash}`);
    } catch {
      setLinkError(true);
    }
  };
  const joinButton = (
    <Button
      className="h-11 gap-2 rounded-xl px-4"
      onClick={() => setJoinOpen(true)}
      aria-haspopup="dialog"
    >
      <Link2 className="size-4" />
      {t('platform.workbench.joinClassroom')}
    </Button>
  );

  return (
    <>
      <PageHeader title={t('platform.pages.student.title')} actions={joinButton} />
      <Suspense fallback={null}><TrainingTaskEntry role="student" /></Suspense>
      <CourseWorkbench
        courses={entries}
        loading={loading}
        dashboard={data}
        student
        emptyAction={joinButton}
      />
      <WorkspaceDrawer
        open={joinOpen}
        onOpenChange={setJoinOpen}
        title={t('platform.workbench.joinClassroom')}
      >
        <form onSubmit={openClassroom} className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5">
            <Link2 className="mb-3 size-6 text-primary" />
            <label htmlFor="classroom-link" className="block text-lg font-semibold">
              {t('platform.design.classroomLink')}
            </label>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('platform.design.studentLinkHint')}
            </p>
          </div>
          <Input
            id="classroom-link"
            value={classroomLink}
            onChange={(event) => {
              setClassroomLink(event.target.value);
              setLinkError(false);
            }}
            placeholder={t('platform.design.classroomLinkPlaceholder')}
            aria-invalid={linkError || undefined}
            aria-describedby={linkError ? 'classroom-link-error' : undefined}
            className="h-12 rounded-xl bg-card"
          />
          {linkError && (
            <p id="classroom-link-error" role="alert" className="text-sm text-destructive">
              {t('platform.design.invalidClassroomLink')}
            </p>
          )}
          <Button
            type="submit"
            disabled={!classroomLink.trim()}
            className="h-12 w-full justify-between rounded-xl px-4"
          >
            {t('platform.design.openClassroom')}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      </WorkspaceDrawer>
    </>
  );
}
