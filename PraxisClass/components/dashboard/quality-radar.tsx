'use client';

import { useMemo } from 'react';

import type { DashboardPayload } from '@/lib/platform/analytics/aggregate';
import { useI18n } from '@/lib/hooks/use-i18n';

import { chartTheme, EChart, type ChartOption } from './echarts-base';
import { EmptyChart } from './empty-chart';

type RadarRow = DashboardPayload['quality']['radar'][number];

const DIMENSION_ORDER = [
  'generation_quality',
  'usability',
  'classroom_fit',
  'engagement_observed',
  'comprehension_observed',
] as const;

interface QualityRadarProps {
  rows: RadarRow[];
  height?: number;
}

export function QualityRadar({ rows, height = 260 }: QualityRadarProps) {
  const { t } = useI18n();

  const ordered = useMemo(
    () =>
      DIMENSION_ORDER.map(
        (dimension) =>
          rows.find((row) => row.dimension === dimension) ?? { dimension, avg: null, n: 0 },
      ),
    [rows],
  );

  const option = useMemo<ChartOption>(() => {
    const theme = chartTheme();
    return {
      tooltip: { trigger: 'item' },
      radar: {
        indicator: ordered.map((row) => ({
          name: t(`platform.dashboard.dimension.${row.dimension}`),
          max: 5,
        })),
        axisName: { color: theme.axis, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.split } },
        axisLine: { lineStyle: { color: theme.split } },
        splitArea: { show: false },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 4,
          itemStyle: { color: theme.palette[0] },
          lineStyle: { color: theme.palette[0], width: 2 },
          areaStyle: { color: theme.dark ? 'rgba(167,139,250,0.25)' : 'rgba(124,58,237,0.18)' },
          data: [
            {
              name: t('platform.dashboard.qualityRadar'),
              value: ordered.map((row) => row.avg ?? 0),
            },
          ],
        },
      ],
    };
  }, [ordered, t]);

  if (ordered.every((row) => row.avg === null)) {
    return <EmptyChart hint={t('platform.dashboard.empty.radarHint')} />;
  }

  return <EChart option={option} height={height} />;
}
