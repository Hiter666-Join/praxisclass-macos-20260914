'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/lib/hooks/use-i18n';
import { EmptyState } from './empty-state';

import { nextOccurrence } from '@/lib/platform/schedule/next-occurrence';
import { ScheduleEditor } from './schedule-editor';
import { isScheduleEnabled, useSchedule, type ScheduleItem } from './use-schedule';

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** `weekly:1,3@08:00` → `周一、周三 08:00`; `cron:…` → the raw expression. */
export function describeRRule(rrule: string, t: Translate): string {
  if (rrule.startsWith('cron:')) return rrule.slice('cron:'.length);
  if (!rrule.startsWith('weekly:')) return rrule;
  const [daysPart, timePart] = rrule.slice('weekly:'.length).split('@');
  const labels = daysPart
    .split(',')
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    .map((day) => t(`platform.schedule.day${day}`));
  return `${labels.join('、')} ${timePart ?? ''}`.trim();
}

function formatNext(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleList({ readOnly = false }: { readOnly?: boolean } = {}) {
  const { t } = useI18n();
  const { items, loading, error, reload, save, patch, remove } = useSchedule();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [deleting, setDeleting] = useState<ScheduleItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const closeAll = () => {
    setCreating(false);
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleting || removing) return;
    setRemoving(true);
    try {
      if (await remove(deleting.id)) setDeleting(null);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="workspace-section-heading">
        <h2>{t('platform.design.courseSchedule')}</h2>
        {!readOnly && items.length > 0 && (
          <Button className="h-11 gap-2" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            {t('platform.schedule.add')}
          </Button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">日程读取失败：{error} <Button size="sm" variant="outline" onClick={reload}>重试</Button></p>}
      {loading ? (
        <div
          className="h-40 animate-pulse rounded-2xl bg-muted/60"
          role="status"
          aria-label={t('platform.schedule.loading')}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-6" />}
          title={t('platform.schedule.empty')}
          description={t('platform.schedule.dialogDescription')}
          action={
            !readOnly && (
              <Button className="h-11 gap-2" onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                {t('platform.schedule.add')}
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const weekly = item.rrule.startsWith('weekly:');
            const next = nextOccurrence(item.rrule, new Date(now), item.start_at)?.getTime() ?? null;
            return (
              <li key={item.id} className="workspace-panel p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <h3 className="break-words text-base font-semibold">{item.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="break-all">{describeRRule(item.rrule, t)}</span>
                      <Badge variant={weekly ? 'secondary' : 'outline'}>
                        {weekly
                          ? t('platform.schedule.kindWeekly')
                          : t('platform.schedule.kindCron')}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="mb-1 text-xs text-muted-foreground">
                      {t('platform.schedule.columnNext')}
                    </p>
                    <p className="font-medium tabular-nums">
                      {next === null ? '—' : formatNext(next)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs leading-5 text-muted-foreground">
                  {item.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      {item.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {t('platform.schedule.minutes', { n: item.duration_min })}
                  </span>
                  <span>
                    {t('platform.schedule.columnRemind')} ·{' '}
                    {t('platform.schedule.minutes', { n: item.remind_before_min })}
                  </span>
                </div>
                {!readOnly && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={isScheduleEnabled(item)}
                        aria-label={`${item.title} · ${t('platform.schedule.columnEnabled')}`}
                        onCheckedChange={(checked) => void patch(item.id, { enabled: checked })}
                      />
                      {t('platform.schedule.columnEnabled')}
                    </label>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                        {t('platform.schedule.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleting(item)}
                      >
                        {t('platform.schedule.delete')}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !removing) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('platform.schedule.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('platform.schedule.confirmDelete', { title: deleting?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>
              {t('platform.schedule.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removing}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {t('platform.schedule.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) closeAll();
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('platform.schedule.editTitle') : t('platform.schedule.add')}
            </DialogTitle>
            <DialogDescription>{t('platform.schedule.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <ScheduleEditor
            key={editing?.id ?? 'new'}
            item={editing}
            onCancel={closeAll}
            onSubmit={async (draft) => {
              const ok = await save(draft);
              if (ok) closeAll();
              return ok;
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
