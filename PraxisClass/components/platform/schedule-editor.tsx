'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

import type { ScheduleDraft, ScheduleItem } from './use-schedule';

export const WEEKDAY_KEYS = [1, 2, 3, 4, 5, 6, 7] as const;

type RRuleKind = 'weekly' | 'cron';

interface ParsedRRule {
  kind: RRuleKind;
  days: number[];
  time: string;
  cron: string;
}

function parseRRule(rrule: string | undefined): ParsedRRule {
  if (rrule?.startsWith('cron:')) {
    return { kind: 'cron', days: [], time: '08:00', cron: rrule.slice('cron:'.length) };
  }
  if (rrule?.startsWith('weekly:')) {
    const [daysPart, timePart] = rrule.slice('weekly:'.length).split('@');
    const days = daysPart
      .split(',')
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
    return { kind: 'weekly', days, time: timePart || '08:00', cron: '' };
  }
  return { kind: 'weekly', days: [], time: '08:00', cron: '' };
}

interface ScheduleEditorProps {
  item?: ScheduleItem | null;
  onSubmit: (draft: ScheduleDraft) => Promise<boolean> | boolean;
  onCancel?: () => void;
}

export function ScheduleEditor({ item, onSubmit, onCancel }: ScheduleEditorProps) {
  const { t } = useI18n();
  const initial = parseRRule(item?.rrule);

  const [title, setTitle] = useState(item?.title ?? '');
  const [location, setLocation] = useState(item?.location ?? '');
  const [classroomUrl, setClassroomUrl] = useState(item?.classroom_url ?? '');
  const [durationMin, setDurationMin] = useState(String(item?.duration_min ?? 45));
  const [remindBeforeMin, setRemindBeforeMin] = useState(String(item?.remind_before_min ?? 10));
  const [enabled, setEnabled] = useState(
    item ? item.enabled !== false && item.enabled !== 0 : true,
  );
  const [kind, setKind] = useState<RRuleKind>(initial.kind);
  const [days, setDays] = useState<number[]>(initial.days);
  const [time, setTime] = useState(initial.time);
  const [cron, setCron] = useState(initial.cron);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: number) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const submit = async () => {
    if (!title.trim()) {
      setError(t('platform.schedule.errorTitle'));
      return;
    }
    let rrule: string;
    if (kind === 'weekly') {
      if (days.length === 0) {
        setError(t('platform.schedule.errorDays'));
        return;
      }
      rrule = `weekly:${days.join(',')}@${time || '08:00'}`;
    } else {
      if (!cron.trim()) {
        setError(t('platform.schedule.errorCron'));
        return;
      }
      rrule = `cron:${cron.trim()}`;
    }
    setError(null);
    setSaving(true);
    const draft: ScheduleDraft = {
      ...(item ? { id: item.id } : {}),
      title: title.trim(),
      rrule,
      start_at: item?.start_at ?? Date.now(),
      duration_min: Number(durationMin) || 45,
      remind_before_min: Number(remindBeforeMin) || 0,
      enabled,
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(classroomUrl.trim() ? { classroom_url: classroomUrl.trim() } : {}),
    };
    await onSubmit(draft);
    setSaving(false);
  };

  return (
    <form
      className="space-y-5 [&_input]:h-11"
      onSubmit={(event) => {
        event.preventDefault();
        if (!saving) void submit();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="schedule-title">{t('platform.schedule.fieldTitle')}</Label>
        <Input
          id="schedule-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('platform.schedule.fieldTitlePlaceholder')}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="schedule-location">{t('platform.schedule.fieldLocation')}</Label>
          <Input
            id="schedule-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="schedule-url">{t('platform.schedule.fieldClassroomUrl')}</Label>
          <Input
            id="schedule-url"
            value={classroomUrl}
            onChange={(event) => setClassroomUrl(event.target.value)}
            placeholder="/classroom/xxxx"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="schedule-duration">{t('platform.schedule.fieldDuration')}</Label>
          <Input
            id="schedule-duration"
            type="number"
            min={1}
            value={durationMin}
            onChange={(event) => setDurationMin(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="schedule-remind">{t('platform.schedule.fieldRemind')}</Label>
          <Input
            id="schedule-remind"
            type="number"
            min={0}
            value={remindBeforeMin}
            onChange={(event) => setRemindBeforeMin(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('platform.schedule.fieldRepeat')}</Label>
        <Select value={kind} onValueChange={(value) => setKind(value as RRuleKind)}>
          <SelectTrigger className="h-11 w-48" aria-label={t('platform.schedule.fieldRepeat')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">{t('platform.schedule.kindWeekly')}</SelectItem>
            <SelectItem value="cron">{t('platform.schedule.kindCron')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {kind === 'weekly' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_KEYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={days.includes(day)}
                className={cn(
                  'h-11 w-11 rounded-lg border text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                  days.includes(day)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted',
                )}
              >
                {t(`platform.schedule.dayShort${day}`)}
              </button>
            ))}
          </div>
          <Input
            type="time"
            aria-label={t('platform.schedule.columnNext')}
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className="w-36"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            value={cron}
            onChange={(event) => setCron(event.target.value)}
            placeholder="0 8 * * 1-5"
          />
          <p className="text-xs text-muted-foreground">{t('platform.schedule.cronHint')}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch id="schedule-enabled" checked={enabled} onCheckedChange={setEnabled} />
        <Label htmlFor="schedule-enabled">{t('platform.schedule.fieldEnabled')}</Label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2 border-t pt-4">
        <Button type="submit" className="h-11" disabled={saving}>
          {t('platform.schedule.save')}
        </Button>
        {onCancel && (
          <Button type="button" className="h-11" variant="ghost" onClick={onCancel}>
            {t('platform.schedule.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
