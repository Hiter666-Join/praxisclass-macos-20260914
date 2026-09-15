'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';

import { useI18n } from '@/lib/hooks/use-i18n';
import { nextOccurrence } from '@/lib/platform/schedule/next-occurrence';
import { useSchedule } from './use-schedule';

interface ScheduleItem {
  id: string;
  title: string;
  location?: string | null;
  rrule: string;
  start_at: number;
  duration_min: number;
  classroom_url?: string | null;
  remind_before_min: number;
  enabled?: boolean | number;
}

/** `weekly:1,3,5@08:00` → the next matching local timestamp, or null. */
export function nextWeeklyOccurrence(rrule: string, from: number): number | null {
  const spec = rrule.slice('weekly:'.length);
  const [daysPart, timePart] = spec.split('@');
  const [hours, minutes] = (timePart ?? '').split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  const days = daysPart
    .split(',')
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
  if (days.length === 0) return null;

  const base = new Date(from);
  let best: number | null = null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    // JS weekdays are 0=Sun..6=Sat; the rrule uses 1=Mon..7=Sun.
    const rruleDay = candidate.getDay() === 0 ? 7 : candidate.getDay();
    if (!days.includes(rruleDay)) continue;
    const time = candidate.getTime();
    if (time <= from) continue;
    if (best === null || time < best) best = time;
  }
  return best;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function NextClassBanner() {
  const { t } = useI18n();
  const { items, error, reload } = useSchedule();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const enabled = useMemo(
    () => items.filter((item) => item.enabled !== false && item.enabled !== 0),
    [items],
  );

  const nextWeekly = useMemo(() => {
    let best: { item: ScheduleItem; at: number } | null = null;
    for (const item of enabled) {
      const at = nextOccurrence(item.rrule, new Date(now), item.start_at)?.getTime() ?? null;
      if (at === null) continue;
      if (best === null || at < best.at) best = { item, at };
    }
    return best;
  }, [enabled, now]);

  if (error) return <p role="alert" className="text-sm text-destructive">日程读取失败。<button className="ml-2 underline" onClick={reload}>重试</button></p>;

  if (!nextWeekly) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">{t('platform.empty.schedule')}</p>
    );
  }

  const { item, at } = nextWeekly!;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm font-medium">{item.title}</span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {t('platform.banner.countdown', { time: formatCountdown(at - now) })}
      </span>
      {item.location && <span className="text-xs text-muted-foreground">{item.location}</span>}
      {item.classroom_url && (
        <Link
          href={item.classroom_url}
          className="ml-auto text-sm text-primary underline-offset-4 hover:underline"
        >
          {t('platform.banner.enter')}
        </Link>
      )}
    </div>
  );
}
