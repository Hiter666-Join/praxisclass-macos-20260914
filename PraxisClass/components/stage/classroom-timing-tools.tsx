'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Clock3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WorkspaceDrawer } from '@/components/platform/workspace-drawer';
import { ScheduleList } from '@/components/platform/schedule-list';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';

export function ClassroomTimingTools() {
  const { t, locale } = useI18n();
  const teacherMode = useSettingsStore((state) => state.mode === 'teacher');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const onVisible = () => {
      if (!document.hidden) update();
    };
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(onVisible, 1000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const formatTime = (timestamp: number) =>
    new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(timestamp);
  const time = now === null ? '—' : formatTime(now);

  return (
    <div
      data-classroom-timing
      className="flex shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-card/80 p-1 shadow-xs backdrop-blur-xl"
    >
      <Button
        variant="ghost"
        className="h-9 gap-2 rounded-lg px-2.5 text-sm"
        onClick={() => setScheduleOpen(true)}
        aria-haspopup="dialog"
      >
        <CalendarClock className="size-4 text-primary" />
        {t('platform.nav.schedule')}
      </Button>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
      <Popover onOpenChange={() => setSyncedAt(null)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 gap-2 rounded-lg px-2.5"
            aria-label={t('platform.classroomTools.localTime')}
          >
            <Clock3 className="size-4 text-muted-foreground" />
            <time
              data-classroom-clock
              className="min-w-[4.6rem] text-sm font-medium tabular-nums"
              dateTime={now === null ? undefined : new Date(now).toISOString()}
            >
              {time}
            </time>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={10}
          className="workspace-palette w-80 max-w-[calc(100vw-2rem)] space-y-4 rounded-2xl bg-card p-5 text-foreground shadow-lg"
          aria-label={t('platform.classroomTools.localTime')}
        >
          <div>
            <h2 className="text-base font-semibold">{t('platform.classroomTools.localTime')}</h2>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{time}</p>
          </div>
          {now !== null && (
            <p className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(now)}
              <br />
              {t('platform.classroomTools.timeZone')} ·{' '}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          )}
          <p className="text-sm leading-6 text-muted-foreground">
            {t('platform.classroomTools.timeHint')}
          </p>
          <Button
            variant="outline"
            className="h-10 w-full gap-2 rounded-xl"
            onClick={() => {
              const timestamp = Date.now();
              setNow(timestamp);
              setSyncedAt(timestamp);
            }}
          >
            <RefreshCw className="size-4" />
            {t('platform.classroomTools.syncTime')}
          </Button>
          {syncedAt !== null && (
            <p role="status" className="text-xs text-muted-foreground">
              {t('platform.classroomTools.synced')} · {formatTime(syncedAt)}
            </p>
          )}
        </PopoverContent>
      </Popover>
      <WorkspaceDrawer
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        title={t('platform.nav.schedule')}
      >
        <ScheduleList readOnly={!teacherMode} />
      </WorkspaceDrawer>
    </div>
  );
}
