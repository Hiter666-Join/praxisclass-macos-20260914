'use client';

import { useMemo } from 'react';

import type { DashboardPayload } from '@/lib/platform/analytics/aggregate';
import { useI18n } from '@/lib/hooks/use-i18n';

import { chartTheme, EChart, type ChartOption } from './echarts-base';
import { EmptyChart } from './empty-chart';

export type VersionTrendRow = DashboardPayload['versionTrend'][number];

interface VersionTrendChartProps {
  rows: VersionTrendRow[];
  compact?: boolean;
  courseNames?: Record<string, string>;
}

/** `v10` sorts after `v2`; anything without a numeric tail falls back to string order. */
function compareVersion(left: string, right: string): number {
  const leftNumber = Number(left.replace(/^\D+/, ''));
  const rightNumber = Number(right.replace(/^\D+/, ''));
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

export function VersionTrendChart({ rows, compact = false, courseNames }: VersionTrendChartProps) {
  const { t } = useI18n();

  const grouped = useMemo(() => {
    const byCourse = new Map<string, VersionTrendRow[]>();
    for (const row of rows) {
      if (row.passRate === null && row.avgTeacherRating === null) continue;
      const bucket = byCourse.get(row.courseId) ?? [];
      bucket.push(row);
      byCourse.set(row.courseId, bucket);
    }
    const entries = [...byCourse.entries()].sort((left, right) => left[0].localeCompare(right[0]));
    return compact ? entries.slice(0, 1) : entries;
  }, [rows, compact]);

  const versions = useMemo(() => {
    const set = new Set<string>();
    for (const [, bucket] of grouped) for (const row of bucket) set.add(row.courseVersion);
    return [...set].sort(compareVersion);
  }, [grouped]);

  const option = useMemo<ChartOption>(() => {
    const theme = chartTheme();
    const lineSeries = grouped.map(([courseId, bucket], index) => ({
      name: courseNames?.[courseId] ?? t('platform.design.courseNumber', { number: index + 1 }),
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      connectNulls: true,
      yAxisIndex: 0,
      itemStyle: { color: theme.palette[index % theme.palette.length] },
      lineStyle: { color: theme.palette[index % theme.palette.length], width: 2 },
      data: versions.map((version) => {
        const row = bucket.find((item) => item.courseVersion === version);
        return row && row.passRate !== null ? Math.round(row.passRate * 1000) / 10 : null;
      }),
    }));

    const barSeries = grouped
      .map(([courseId, bucket], index) => ({
        name: t('platform.dashboard.ratingSeries', {
          course:
            courseNames?.[courseId] ?? t('platform.design.courseNumber', { number: index + 1 }),
        }),
        type: 'bar' as const,
        yAxisIndex: 1,
        barMaxWidth: 18,
        itemStyle: { color: theme.palette[index % theme.palette.length], opacity: 0.35 },
        data: versions.map((version) => {
          const row = bucket.find((item) => item.courseVersion === version);
          return row && row.avgTeacherRating !== null
            ? Math.round(row.avgTeacherRating * 100) / 100
            : null;
        }),
      }))
      .filter((series) => series.data.some((value) => value !== null));

    return {
      tooltip: { trigger: 'axis', renderMode: 'richText' },
      legend: compact
        ? { show: false }
        : {
            show: true,
            type: 'scroll',
            top: 0,
            textStyle: { color: theme.axis, fontSize: 11, width: 120, overflow: 'truncate' },
          },
      grid: { left: 44, right: 44, top: compact ? 12 : 32, bottom: 28 },
      xAxis: {
        type: 'category',
        data: versions,
        axisLabel: { color: theme.axis, fontSize: 11 },
        axisLine: { lineStyle: { color: theme.split } },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          max: 100,
          axisLabel: { color: theme.axis, fontSize: 11, formatter: '{value}%' },
          splitLine: { lineStyle: { color: theme.split } },
        },
        {
          type: 'value',
          min: 1,
          max: 5,
          show: barSeries.length > 0,
          axisLabel: { color: theme.axis, fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: [...lineSeries, ...barSeries],
    };
  }, [grouped, versions, compact, courseNames, t]);

  if (grouped.length === 0) {
    return (
      <EmptyChart hint={t('platform.dashboard.empty.trendHint')} height={compact ? 120 : 160} />
    );
  }

  if (versions.length === 1) {
    return (
      <div className="space-y-5">
        <p className="text-xs leading-6 text-muted-foreground">
          {t('platform.design.versionBaseline')}
        </p>
        <dl className="space-y-5">
          {grouped.map(([courseId, bucket], index) => {
            const row = bucket[0];
            const rate = row.passRate === null ? null : Math.round(row.passRate * 1000) / 10;
            return (
              <div key={courseId} className="rounded-xl bg-muted/40 p-4">
                <dt className="text-xs leading-5 text-muted-foreground">
                  {!compact && (
                    <span className="mr-2 font-medium text-foreground">
                      {courseNames?.[courseId] ??
                        t('platform.design.courseNumber', { number: index + 1 })}
                    </span>
                  )}
                  {row.courseVersion}
                </dt>
                {rate !== null && (
                  <dd className="mt-2 flex items-baseline justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {t('platform.teacher.passRate')}
                    </span>
                    <span className="text-2xl font-medium tabular-nums">{rate}%</span>
                  </dd>
                )}
                {row.avgTeacherRating !== null && (
                  <dd className="mt-2 flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-xs text-muted-foreground">
                      {t('platform.dashboard.ratingSeries', { course: row.courseVersion })}
                    </span>
                    <span className="tabular-nums">
                      {Math.round(row.avgTeacherRating * 10) / 10} / 5
                    </span>
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      </div>
    );
  }

  return <EChart option={option} height={compact ? 160 : 280} />;
}
