'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { DashboardPayload } from '@/lib/platform/analytics/aggregate';

export interface CourseStats {
  version: string | null;
  passRate: number | null;
  attempts: number;
  feedbackCount: number;
}

/** Resolve the classroom to its logical course and version before reading counts. */
export function matchCourseStats(
  dashboard: DashboardPayload | null,
  stageId: string,
  fallbackKey?: string,
): CourseStats {
  if (!dashboard) return { version: null, passRate: null, attempts: 0, feedbackCount: 0 };
  const label = dashboard.courseCatalog?.find((row) => row.stage_id === stageId);
  if (label) {
    const row = dashboard.versionTrend.find(
      (item) => item.courseId === label.course_id && item.courseVersion === label.course_version,
    );
    return {
      version: label.course_version,
      passRate: row?.passRate ?? null,
      attempts: row?.testTotal ?? 0,
      feedbackCount: row?.feedbackCount ?? 0,
    };
  }
  const keys = [stageId, ...(fallbackKey ? [fallbackKey] : [])];
  const trend = dashboard.versionTrend.filter((row) => keys.includes(row.courseId));
  const rate = dashboard.passRate.byCourse.find((row) => keys.includes(row.key));
  return {
    version: trend.at(-1)?.courseVersion ?? null,
    passRate: rate ? rate.rate : null,
    attempts: rate ? rate.total : 0,
    feedbackCount: trend.reduce((sum, row) => sum + row.feedbackCount, 0),
  };
}

interface CourseCardProps {
  id: string;
  title: string;
  updatedLabel?: string;
  stats: CourseStats;
  onFeedback?: () => void;
  onPrepFeedback?: () => void;
  progressLabel?: string;
  enterLabel?: string;
  managementActions?: ReactNode;
}

export function CourseCard({
  id,
  title,
  updatedLabel,
  stats,
  onFeedback,
  onPrepFeedback,
  progressLabel,
  enterLabel,
  managementActions,
}: CourseCardProps) {
  const { t } = useI18n();
  const ratePercent = stats.passRate === null ? null : Math.round(stats.passRate * 100);

  return (
    <article className="workspace-panel group flex h-full min-w-0 flex-col overflow-hidden transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-[0_5px_20px_oklch(0.2_0.01_270_/_0.035)]">
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <BookOpen className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            {t('platform.teacher.versionLabel', { version: stats.version ?? '—' })}
          </p>
        </div>
        <h2 className="mb-2 line-clamp-2 min-h-12 text-base font-semibold leading-6 tracking-tight">
          <Link
            href={`/classroom/${id}`}
            className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {title}
          </Link>
        </h2>
        {updatedLabel && (
          <p className="text-xs leading-5 text-muted-foreground">
            {t('platform.teacher.updatedAt', { date: updatedLabel })}
          </p>
        )}

        <div className="mt-6 space-y-2.5">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{progressLabel ?? t('platform.teacher.passRate')}</span>
            <span className="tabular-nums">
              {ratePercent === null ? '—' : `${ratePercent}% (${stats.attempts})`}
            </span>
          </div>
          {ratePercent === null ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {t('platform.design.noPractice')}
            </p>
          ) : (
            <Progress value={ratePercent} className="h-1.5" />
          )}
        </div>

        <p className="mb-5 mt-3 text-xs text-muted-foreground">
          {t('platform.teacher.feedbackCount', { n: stats.feedbackCount })}
        </p>

        <div className="mt-auto flex flex-wrap gap-2">
          <Button
            className="h-10 w-full justify-between rounded-xl px-3"
            variant="secondary"
            asChild
          >
            <Link href={`/classroom/${id}`}>
              {enterLabel ?? t('platform.teacher.enterClassroom')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {managementActions && <div className="mt-3 flex flex-wrap gap-2">{managementActions}</div>}
      </div>
      {(onFeedback || onPrepFeedback) && (
        <div className="flex flex-wrap gap-1 border-t border-border/70 bg-background/50 px-4 py-2.5">
          {onFeedback && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={onFeedback}
            >
              {t('platform.teacher.postClassFeedback')}
            </Button>
          )}
          {onPrepFeedback && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={onPrepFeedback}
            >
              {t('platform.forms.teacherPrepTrigger')}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
