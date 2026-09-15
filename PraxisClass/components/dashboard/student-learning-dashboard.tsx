'use client';

import Link from 'next/link';
import { Award, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/components/platform/use-dashboard-data';
import { useRecentCourses } from '@/components/platform/recent-courses';
import { useI18n } from '@/lib/hooks/use-i18n';

export function StudentLearningDashboard() {
  const { t, locale } = useI18n();
  const { data, loading, error, refresh } = useDashboard('self');
  const { courses } = useRecentCourses();
  const learning = data?.learning;
  const names = Object.fromEntries(courses.map((course) => [course.id, course.name]));
  if (loading) return <p role="status">{t('platform.dashboard.loading')}</p>;
  if (error || !learning)
    return (
      <div role="alert">
        <p>{t('platform.design.dashboardError')}</p>
        <Button onClick={refresh}>{t('common.retry')}</Button>
      </div>
    );
  const stats = [
    ['attempts', learning.attemptCount],
    ['courses', learning.courseCount],
    ['corrected', learning.correctedCases],
    [
      'latestRate',
      learning.latestPassRate === null ? '—' : `${Math.round(learning.latestPassRate * 100)}%`,
    ],
  ] as const;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {t('studentLearning.scopeNote')}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="size-4" />
            {t('platform.dashboard.refresh')}
          </Button>
          <Button asChild>
            <Link href="/student/feedback">{t('studentLearning.feedback')}</Link>
          </Button>
        </div>
      </div>
      <dl className="workspace-panel grid grid-cols-2 gap-6 p-6 lg:grid-cols-4">
        {stats.map(([key, value]) => (
          <div key={key}>
            <dt className="text-sm text-muted-foreground">{t(`studentLearning.${key}`)}</dt>
            <dd className="mt-2 text-3xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {learning.pendingAttempts > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('studentLearning.syncing', { count: learning.pendingAttempts })}
        </p>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('studentLearning.achievements')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {learning.achievements.map((item) => (
            <div
              key={item.id}
              className={`workspace-panel flex items-start gap-3 p-5 ${item.earned ? 'border-primary/30 bg-primary/5' : ''}`}
            >
              <Award
                className={`mt-1 size-6 shrink-0 ${item.earned ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <div>
                <h3 className="font-medium">{t(`studentLearning.badges.${item.id}`)}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t(`studentLearning.badgeHints.${item.id}`)}
                </p>
                <p className="mt-2 flex items-center gap-1 text-xs">
                  {item.earned && <Check className="size-3" />}
                  {t(item.earned ? 'studentLearning.earned' : 'studentLearning.notYet')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="workspace-panel space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">{t('studentLearning.history')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('studentLearning.historyHint')}</p>
        </div>
        {learning.recentAttempts.length === 0 ? (
          <div className="space-y-3 py-5">
            <p>{t('studentLearning.empty')}</p>
            <Button asChild variant="outline">
              <Link href="/student">{t('studentLearning.chooseCourse')}</Link>
            </Button>
          </div>
        ) : (
          <ol className="space-y-5">
            {learning.recentAttempts.map((attempt) => (
              <li
                key={attempt.id}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem] sm:gap-5"
              >
                <div className="min-w-0">
                  <Link
                    className="line-clamp-2 font-medium hover:underline"
                    href={`/classroom/${encodeURIComponent(attempt.stageId)}`}
                  >
                    {names[attempt.stageId] ?? t('studentLearning.practice')}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(
                      attempt.suite.startsWith('quiz_')
                        ? 'studentLearning.quiz'
                        : 'studentLearning.practice',
                    )}{' '}
                    · {new Date(attempt.createdAt).toLocaleString(locale)}
                  </p>
                </div>
                <div className="self-center">
                  <p className="mb-1 text-right text-sm tabular-nums">
                    {attempt.passed}/{attempt.total}
                  </p>
                  <progress
                    aria-label={t('studentLearning.passedCases')}
                    className="h-2 w-full accent-primary"
                    value={attempt.passed}
                    max={attempt.total}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      {(data?.recordCounts?.legacy ?? 0) > 0 && (
        <p className="text-sm leading-6 text-muted-foreground">
          {t('studentLearning.legacyNote', { count: data?.recordCounts?.legacy })}
        </p>
      )}
    </div>
  );
}
