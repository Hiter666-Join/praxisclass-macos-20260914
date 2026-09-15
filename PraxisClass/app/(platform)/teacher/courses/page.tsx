'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, PenLine, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { PageHeader } from '@/components/platform/page-header';
import { EmptyState } from '@/components/platform/empty-state';
import { CourseCard, matchCourseStats } from '@/components/platform/course-card';
import { CourseManagement } from '@/components/platform/course-management';
import { formatUpdatedAt, useRecentCourses } from '@/components/platform/recent-courses';
import { useDashboard } from '@/components/platform/use-dashboard-data';
import { FeedbackDialog } from '@/components/forms/feedback-dialog';
import { teacherPostClassSchema, teacherPrepSchema } from '@/lib/platform/forms/schemas';
import { useI18n } from '@/lib/hooks/use-i18n';

export default function TeacherCoursesPage() {
  const { t } = useI18n();
  const { data, refresh } = useDashboard('all');
  const { courses, loading, refresh: refreshCourses } = useRecentCourses();
  const [query, setQuery] = useState('');
  const filteredCourses = courses.filter((course) =>
    course.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const [feedbackFor, setFeedbackFor] = useState<{
    id: string;
    name: string;
    kind: 'prep' | 'post-class';
  } | null>(null);

  return (
    <>
      <PageHeader
        title={t('platform.pages.teacherCourses.title')}
        description={t('platform.pages.teacherCourses.description')}
        actions={
          courses.length > 0 && (
            <Button asChild className="h-11 gap-2 rounded-xl px-5">
              <Link href="/">
                <PenLine className="size-4" />
                {t('platform.design.newCourse')}
              </Link>
            </Button>
          )
        }
      />

      {loading ? (
        <div
          aria-busy="true"
          aria-label={t('platform.dashboard.loading')}
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {[1, 2, 3].map((row) => (
            <div key={row} className="h-64 rounded-2xl bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          title={t('platform.design.emptyCourseTitle')}
          description={t('platform.design.planHint')}
          icon={<BookOpen className="size-5" />}
          action={
            <Button asChild className="h-11 gap-2 rounded-xl px-5">
              <Link href="/">
                <PenLine className="size-4" />
                {t('platform.design.newCourse')}
              </Link>
            </Button>
          }
        />
      ) : (
        <section>
          <div className="workspace-section-heading mb-5">
            <h2>
              {t('platform.design.courseLibrary')}
              <span className="ml-3 text-xs font-normal tabular-nums text-muted-foreground">
                {courses.length}
              </span>
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('platform.design.courseSearch')}
                aria-label={t('platform.design.courseSearch')}
                className="h-10 rounded-xl bg-card pl-9"
              />
            </div>
          </div>
          {filteredCourses.length === 0 ? (
            <EmptyState
              title={t('platform.design.noMatchingCourses')}
              action={
                <Button variant="outline" onClick={() => setQuery('')}>
                  {t('platform.design.clearSearch')}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  id={course.id}
                  title={course.name}
                  updatedLabel={formatUpdatedAt(course.updatedAt)}
                  stats={matchCourseStats(data, course.id, course.name)}
                  managementActions={<CourseManagement id={course.id} name={course.name} onChanged={refreshCourses} />}
                  onFeedback={() =>
                    setFeedbackFor({ id: course.id, name: course.name, kind: 'post-class' })
                  }
                  onPrepFeedback={() =>
                    setFeedbackFor({ id: course.id, name: course.name, kind: 'prep' })
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {feedbackFor && (
        <FeedbackDialog
          open
          onOpenChange={(open) => {
            if (!open) setFeedbackFor(null);
          }}
          schema={feedbackFor.kind === 'prep' ? teacherPrepSchema : teacherPostClassSchema}
          subjectId="teacher:main"
          courseId={
            data?.courseCatalog?.find((row) => row.stage_id === feedbackFor.id)?.course_id ??
            feedbackFor.id
          }
          courseVersion={matchCourseStats(data, feedbackFor.id).version ?? undefined}
          stageId={feedbackFor.id}
          title={feedbackFor.name}
          onSubmitted={() => refresh()}
        />
      )}
    </>
  );
}
