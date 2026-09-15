'use client';

import { useMemo } from 'react';

import type { DashboardPayload } from '@/lib/platform/analytics/aggregate';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/hooks/use-i18n';

import { chartTheme, EChart, type ChartOption } from './echarts-base';
import { EmptyChart } from './empty-chart';

type FailureRow = DashboardPayload['failures']['rows'][number];
type ReasonRow = DashboardPayload['failures']['topReasons'][number];

interface FailureTableProps {
  rows: FailureRow[];
  topReasons: ReasonRow[];
}

const MAX_ROWS = 50;

function maskLearner(key: string): string {
  return key.length > 8 ? `${key.slice(0, 8)}…` : key;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function FailureTable({ rows, topReasons }: FailureTableProps) {
  const { t } = useI18n();
  const visible = useMemo(() => rows.slice(0, MAX_ROWS), [rows]);
  const reasons = useMemo(() => topReasons.slice(0, 5), [topReasons]);

  const option = useMemo<ChartOption>(() => {
    const theme = chartTheme();
    const ordered = [...reasons].reverse();
    return {
      tooltip: { trigger: 'item' },
      grid: { left: 130, right: 24, top: 8, bottom: 24 },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: theme.axis, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.split } },
      },
      yAxis: {
        type: 'category',
        data: ordered.map((row) => row.reason),
        axisLabel: { color: theme.axis, fontSize: 11, width: 110, overflow: 'truncate' },
        axisLine: { lineStyle: { color: theme.split } },
        axisTick: { show: false },
      },
      series: [
        {
          name: t('platform.dashboard.topReasons'),
          type: 'bar',
          barMaxWidth: 16,
          itemStyle: { color: theme.palette[4], borderRadius: [0, 4, 4, 0] },
          data: ordered.map((row) => row.count),
        },
      ],
    };
  }, [reasons, t]);

  if (visible.length === 0) {
    return <EmptyChart hint={t('platform.dashboard.empty.failureHint')} />;
  }

  return (
    <div className="space-y-4">
      {reasons.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t('platform.dashboard.topReasons')}</p>
          <EChart option={option} height={Math.max(120, reasons.length * 28 + 40)} />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">
                {t('platform.dashboard.column.suite')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('platform.dashboard.column.case')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('platform.dashboard.column.learner')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('platform.dashboard.column.result')}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t('platform.dashboard.column.duration')}
              </th>
              <th className="px-3 py-2 text-left font-medium">
                {t('platform.dashboard.column.reason')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={`${row.suite}:${row.caseId}:${row.learnerKey}:${row.createdAt}`} className="border-t">
                <td className="px-3 py-2">{row.suite}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.caseId}</td>
                <td className="px-3 py-2 font-mono text-xs" title={row.learnerKey}>
                  {maskLearner(row.learnerKey)}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={row.passed ? 'secondary' : 'destructive'}>
                    {row.passed
                      ? t('platform.dashboard.passed')
                      : t('platform.dashboard.failed')}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatDuration(row.durationMs)}
                </td>
                <td className="max-w-[18rem] truncate px-3 py-2 text-muted-foreground" title={row.failureReason ?? ''}>
                  {row.failureReason ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
