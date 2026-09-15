'use client';

import { useMemo } from 'react';

import { useI18n } from '@/lib/hooks/use-i18n';

import { chartTheme, EChart, type ChartOption } from './echarts-base';
import { EmptyChart } from './empty-chart';

export interface PassRateRow {
  key: string;
  label?: string;
  passed: number;
  total: number;
  rate: number;
}

interface PassRateBarsProps {
  title: string;
  rows: PassRateRow[];
  horizontal?: boolean;
  limit?: number;
  height?: number;
}

export function PassRateBars({
  title,
  rows,
  horizontal = false,
  limit = 12,
  height = 240,
}: PassRateBarsProps) {
  const { t } = useI18n();
  const visible = useMemo(() => rows.slice(0, limit), [rows, limit]);

  const option = useMemo<ChartOption>(() => {
    const theme = chartTheme();
    const labels = visible.map((row) => row.label ?? row.key);
    const values = visible.map((row) => Math.round(row.rate * 1000) / 10);
    const categoryAxis = {
      type: 'category' as const,
      data: labels,
      axisLabel: { color: theme.axis, fontSize: 11, width: 90, overflow: 'truncate' },
      axisLine: { lineStyle: { color: theme.split } },
      axisTick: { show: false },
    };
    const valueAxis = {
      type: 'value' as const,
      max: 100,
      axisLabel: { color: theme.axis, fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: theme.split } },
    };
    return {
      tooltip: {
        trigger: 'item',
        renderMode: 'richText',
        formatter: (params: { dataIndex: number }) => {
          const row = visible[params.dataIndex];
          if (!row) return '';
          return `${row.label ?? row.key}\n${Math.round(row.rate * 1000) / 10}% · ${row.passed}/${row.total}`;
        },
      },
      grid: horizontal
        ? { left: 110, right: 24, top: 12, bottom: 28 }
        : { left: 48, right: 16, top: 12, bottom: 56 },
      xAxis: horizontal
        ? valueAxis
        : { ...categoryAxis, axisLabel: { ...categoryAxis.axisLabel, rotate: 30 } },
      yAxis: horizontal ? { ...categoryAxis, inverse: true } : valueAxis,
      series: [
        {
          name: title,
          type: 'bar',
          barMaxWidth: 22,
          itemStyle: {
            color: theme.palette[0],
            borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
          },
          data: values,
        },
      ],
    };
  }, [visible, horizontal, title]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {visible.length === 0 ? (
        <EmptyChart hint={t('platform.dashboard.empty.passRateHint')} />
      ) : (
        <EChart option={option} height={height} />
      )}
    </div>
  );
}
