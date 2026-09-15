'use client';

import { useMemo } from 'react';

import type { DashboardPayload } from '@/lib/platform/analytics/aggregate';
import { FEEDBACK_SCHEMAS } from '@/lib/platform/forms/schemas';
import { useI18n } from '@/lib/hooks/use-i18n';

import { chartTheme, EChart, type ChartOption } from './echarts-base';
import { EmptyChart } from './empty-chart';

type DistributionRow = DashboardPayload['quality']['ratingDistribution'][number];

const ratingLabelKeys = new Map(
  Object.values(FEEDBACK_SCHEMAS).flatMap((schema) =>
    schema.fields
      .filter((field) => field.kind === 'rating')
      .map((field) => [field.key, field.labelKey] as const),
  ),
);

interface RatingDistributionProps {
  rows: DistributionRow[];
  height?: number;
}

export function RatingDistribution({ rows, height = 260 }: RatingDistributionProps) {
  const { t } = useI18n();

  const option = useMemo<ChartOption>(() => {
    const theme = chartTheme();
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: { color: theme.axis, fontSize: 11 } },
      grid: { left: 48, right: 16, top: 32, bottom: 56 },
      xAxis: {
        type: 'category',
        data: rows.map((row) => {
          const labelKey = ratingLabelKeys.get(row.field);
          return labelKey ? t(labelKey) : row.field;
        }),
        axisLabel: { color: theme.axis, fontSize: 11, rotate: 30, width: 90, overflow: 'truncate' },
        axisLine: { lineStyle: { color: theme.split } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: theme.axis, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.split } },
      },
      series: [1, 2, 3, 4, 5].map((score, index) => ({
        name: t('platform.dashboard.scoreLabel', { n: score }),
        type: 'bar' as const,
        stack: 'rating',
        barMaxWidth: 28,
        itemStyle: { color: theme.palette[index % theme.palette.length] },
        data: rows.map((row) => row.counts[index]),
      })),
    };
  }, [rows, t]);

  const allZero = rows.every((row) => row.counts.every((count) => count === 0));
  if (rows.length === 0 || allZero) {
    return <EmptyChart hint={t('platform.dashboard.empty.distributionHint')} />;
  }

  return <EChart option={option} height={height} />;
}
