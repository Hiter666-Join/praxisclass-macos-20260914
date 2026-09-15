'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, PenLine } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from './empty-state';
import { useI18n } from '@/lib/hooks/use-i18n';
import { listStages, type StageListItem } from '@/lib/utils/stage-storage';

interface RecentCoursesState {
  courses: StageListItem[];
  loading: boolean;
  refresh: () => void;
}

/** Recent classrooms, from the same persistence source the home page uses. */
export function useRecentCourses(): RecentCoursesState {
  const [courses, setCourses] = useState<StageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listStages()
      .then((list) => {
        if (cancelled) return;
        setCourses([...list].sort((left, right) => right.updatedAt - left.updatedAt));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  return { courses, loading, refresh: () => setRevision((value) => value + 1) };
}

export function formatUpdatedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

interface RecentCoursesProps {
  courses: StageListItem[];
  limit?: number;
  loading?: boolean;
}

export function RecentCourses({ courses, limit = 6, loading = false }: RecentCoursesProps) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label={t('platform.dashboard.loading')}
        className="workspace-panel space-y-5 p-6"
      >
        {[1, 2, 3].map((row) => (
          <div key={row} className="h-12 rounded-lg bg-muted motion-safe:animate-pulse" />
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <EmptyState
        className="items-start text-left [&_h2]:text-2xl [&_h2]:leading-8"
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
    );
  }

  return (
    <div className="workspace-panel divide-y divide-border/70 overflow-hidden">
      {courses.slice(0, limit).map((course) => (
        <Link
          key={course.id}
          href={`/classroom/${course.id}`}
          className="group flex min-w-0 items-center gap-4 px-5 py-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring sm:px-6"
        >
          <BookOpen className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="truncate text-sm font-semibold group-hover:text-primary">
              {course.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('platform.teacher.updatedAt', { date: formatUpdatedAt(course.updatedAt) })}
            </p>
          </div>
          <span className="hidden text-xs font-medium text-primary sm:inline">
            {t('platform.teacher.enterClassroom')}
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
        </Link>
      ))}
    </div>
  );
}
