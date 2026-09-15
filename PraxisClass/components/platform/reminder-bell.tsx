'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useI18n } from '@/lib/hooks/use-i18n';

import { formatEventTime, useScheduleEvents } from './use-schedule-events';

const MAX_LISTED = 10;

export function ReminderBell({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const { events, unreadCount, markAllRead, error } = useScheduleEvents(enabled);
  const [open, setOpen] = useState(false);

  const listed = events.slice(0, MAX_LISTED);
  if (!enabled) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t('platform.reminders.title')}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] leading-4 text-center text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">
          {t('platform.reminders.title')}
        </div>
        {error && <p role="alert" className="px-3 py-2 text-sm text-destructive">{error}</p>}
        {listed.length === 0 && !error ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t('platform.reminders.empty')}
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {listed.map((event) => (
              <li key={event.id} className="px-3 py-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{event.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatEventTime(event.fireAt)}
                  </span>
                </div>
                {event.location && (
                  <p className="text-xs text-muted-foreground">{event.location}</p>
                )}
                {event.classroomUrl && (
                  <Link
                    href={event.classroomUrl}
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    {t('platform.reminders.enter')}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
