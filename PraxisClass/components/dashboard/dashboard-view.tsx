'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboard } from '@/components/platform/use-dashboard-data';
import { useRecentCourses } from '@/components/platform/recent-courses';
import { useI18n } from '@/lib/hooks/use-i18n';

import { EmptyChart } from './empty-chart';
import { FeedbackRecords } from './feedback-records';
import type { RecordKind } from '@/lib/platform/record-context';

const PassRateBars = dynamic(
  () => import('./pass-rate-bars').then((module) => module.PassRateBars),
  { ssr: false },
);
const VersionTrendChart = dynamic(
  () => import('./version-trend-chart').then((module) => module.VersionTrendChart),
  { ssr: false },
);
const QualityRadar = dynamic(
  () => import('./quality-radar').then((module) => module.QualityRadar),
  {
    ssr: false,
  },
);
const RatingDistribution = dynamic(
  () => import('./rating-distribution').then((module) => module.RatingDistribution),
  { ssr: false },
);
const FailureTable = dynamic(
  () => import('./failure-table').then((module) => module.FailureTable),
  {
    ssr: false,
  },
);

interface DashboardViewProps {
  scope: 'all' | 'self';
}

function ChartCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="workspace-panel min-w-0 space-y-5 p-5 sm:p-6">
      {title && <h3 className="text-left text-lg font-semibold leading-7">{title}</h3>}
      {children}
    </section>
  );
}

export function DashboardView({ scope }: DashboardViewProps) {
  const { t } = useI18n();
  const [recordKind, setRecordKind] = useState<RecordKind>('learning');
  const { data, loading, error, refresh } = useDashboard(scope, recordKind);
  const { courses } = useRecentCourses();
  const courseIds = [
    ...new Set([
      ...(data?.passRate.byCourse.map((row) => row.key) ?? []),
      ...(data?.versionTrend.map((row) => row.courseId) ?? []),
    ]),
  ].sort();
  const courseNames = Object.fromEntries(
    courseIds.map((id, index) => [
      id,
      courses.find((course) => course.id === id)?.name ||
        t('platform.design.courseNumber', { number: index + 1 }),
    ]),
  );
  const [breakdown, setBreakdown] = useState<'byCourse' | 'bySuite' | 'byCase' | 'byLearner'>(
    'byCourse',
  );
  const breakdowns = [
    { key: 'byCourse', label: 'passRateByCourse' },
    { key: 'bySuite', label: 'passRateBySuite' },
    { key: 'byCase', label: 'passRateByCase' },
    ...(scope === 'all' ? [{ key: 'byLearner', label: 'passRateByLearner' }] : []),
  ];
  const activeBreakdown = breakdowns.find((item) => item.key === breakdown) ?? breakdowns[0];

  const overview = data?.overview;
  const passRate = data?.passRate;
  const quality = data?.quality;
  const editMinutes = quality?.avgEditMinutesByVersion ?? [];
  const maxEditMinutes = Math.max(1, ...editMinutes.map((row) => row.avg ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <SelectField
          aria-label={t('studentLearning.recordKind')}
          value={recordKind}
          onValueChange={(value) => setRecordKind(value as RecordKind)}
          options={(['learning', 'demo', 'legacy'] as const).map((value) => ({
            value,
            label: t(`studentLearning.${value}`),
          }))}
          className="sm:w-56"
        />
        <p className="text-sm text-muted-foreground">{t('studentLearning.teacherScopeNote')}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted-foreground" aria-live="polite">
          {data
            ? t('platform.dashboard.generatedAt', {
                time: new Date(data.generatedAt).toLocaleString(),
              })
            : loading
              ? t('platform.dashboard.loading')
              : t('platform.design.dashboardError')}
        </p>
        <Button variant="outline" size="lg" onClick={refresh} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {t('platform.dashboard.refresh')}
        </Button>
      </div>

      {error && data && (
        <p role="alert" className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive">
          {t('platform.design.dashboardError')}
        </p>
      )}
      <dl className="workspace-panel grid grid-cols-2 gap-x-6 gap-y-6 p-5 sm:p-6 lg:grid-cols-4">
        {[
          { label: 'statSessions', value: overview?.learnerSessions },
          { label: 'statFeedback', value: overview?.feedbackCount },
          { label: 'statTestResults', value: overview?.testResultCount },
          {
            label: 'statKnowledge',
            value: overview
              ? `${overview.knowledge.withSource}/${overview.knowledge.total}`
              : undefined,
          },
        ].map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs leading-5 text-muted-foreground">
              {t(`platform.dashboard.${stat.label}`)}
            </dt>
            <dd className="mt-2 text-3xl font-medium tabular-nums tracking-tight">
              {stat.value ?? '—'}
            </dd>
            {stat.label === 'statKnowledge' && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('platform.dashboard.statKnowledgeHint')}
              </p>
            )}
          </div>
        ))}
      </dl>

      {loading && !data ? (
        <div
          className="grid gap-6 lg:grid-cols-2"
          role="status"
          aria-label={t('platform.dashboard.loading')}
        >
          {[0, 1].map((index) => (
            <div key={index} className="h-80 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : data ? (
        <Tabs defaultValue="practice" className="gap-6">
          <TabsList className="h-11 w-full sm:w-fit">
            <TabsTrigger value="practice" className="rounded-lg px-5">
              {t('platform.design.practiceEvidence')}
            </TabsTrigger>
            <TabsTrigger value="feedback" className="rounded-lg px-5">
              {t('platform.design.teachingFeedback')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="practice" className="space-y-6">
            <div className="grid items-start gap-6 xl:grid-cols-2">
              <ChartCard>
                <SelectField
                  value={breakdown}
                  onValueChange={(value) => setBreakdown(value as typeof breakdown)}
                  aria-label={t('platform.design.practiceEvidence')}
                  className="sm:w-72"
                  options={breakdowns.map((item) => ({
                    value: item.key,
                    label: t(`platform.dashboard.${item.label}`),
                  }))}
                />
                <PassRateBars
                  title={t(`platform.dashboard.${activeBreakdown.label}`)}
                  rows={(passRate?.[breakdown] ?? []).map((row) => ({
                    ...row,
                    label: breakdown === 'byCourse' ? courseNames[row.key] : row.key,
                  }))}
                  horizontal
                  limit={10}
                  height={280}
                />
              </ChartCard>
              <ChartCard title={t('platform.dashboard.versionTrend')}>
                <VersionTrendChart rows={data.versionTrend ?? []} courseNames={courseNames} />
              </ChartCard>
            </div>
            <ChartCard title={t('platform.dashboard.failures')}>
              <FailureTable
                rows={data.failures.rows ?? []}
                topReasons={data.failures.topReasons ?? []}
              />
            </ChartCard>
          </TabsContent>
          <TabsContent value="feedback" className="space-y-6">
            <section className="workspace-panel space-y-5 p-6">
              <h3 className="text-lg font-semibold">{t('studentLearning.feedbackRecords')}</h3>
              <FeedbackRecords rows={data?.feedbackEntries ?? []} courseNames={courseNames} />
            </section>
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title={t('platform.dashboard.qualityRadar')}>
                <QualityRadar rows={quality?.radar ?? []} />
              </ChartCard>
              <ChartCard title={t('platform.dashboard.ratingDistribution')}>
                <RatingDistribution rows={quality?.ratingDistribution ?? []} />
              </ChartCard>
            </div>

            <ChartCard title={t('platform.dashboard.editMinutes')}>
              {editMinutes.length === 0 ? (
                <EmptyChart hint={t('platform.dashboard.empty.editMinutesHint')} height={80} />
              ) : (
                <div className="space-y-2">
                  {editMinutes.map((row) => (
                    <div key={row.courseVersion} className="flex items-center gap-3 text-xs">
                      <span className="w-16 shrink-0 text-muted-foreground">
                        {row.courseVersion}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${((row.avg ?? 0) / maxEditMinutes) * 100}%` }}
                        />
                      </span>
                      <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
                        {row.avg === null
                          ? '—'
                          : t('platform.dashboard.minutes', { n: Math.round(row.avg * 10) / 10 })}
                        {` · n=${row.n}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
