'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useI18n } from '@/lib/hooks/use-i18n';
import { subscribeScheduleChanges } from '@/lib/platform/schedule/client-events';

export interface ScheduleEvent {
  id: string;
  scheduleId: string;
  title: string;
  location?: string | null;
  classroomUrl?: string | null;
  fireAt: number;
  remindAt?: number;
  kind: string;
}
const RECEIPTS_KEY = 'praxis.schedule.teacher.receipts';
type Receipts = { seen: string[]; read: string[] };
function readReceipts(): Receipts {
  try {
    const value = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '{}');
    return {
      seen: Array.isArray(value.seen) ? value.seen : [],
      read: Array.isArray(value.read) ? value.read : [],
    };
  } catch {
    return { seen: [], read: [] };
  }
}
function persistReceipts(receipts: Receipts) {
  try {
    localStorage.setItem(
      RECEIPTS_KEY,
      JSON.stringify({ seen: receipts.seen.slice(-500), read: receipts.read.slice(-500) }),
    );
  } catch {
    /* memory remains usable */
  }
}
export function formatEventTime(fireAt: number): string {
  const date = new Date(fireAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const empty = { events: [] as ScheduleEvent[], unreadCount: 0, error: '', markAllRead: () => {} };
export const ScheduleReminderContext = createContext(empty);

/** Mounted once at the app root; bells only consume the result. */
export function useScheduleReminderController(enabled: boolean) {
  const { t } = useI18n();
  const router = useRouter();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [now, setNow] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) {
      setEvents([]);
      setReadIds([]);
      setError('');
      return;
    }
    let cancelled = false;
    let running = false;
    let refreshQueued = false;
    let visibleIds = new Set<string>();
    let receipts = readReceipts();
    const poll = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (running) {
        refreshQueued = true;
        return;
      }
      running = true;
      try {
        const time = Date.now();
        const response = await fetch(`/api/platform/schedule/events?since=${time - 86_400_000}`, {
          cache: 'no-store',
        });
        if (!response.ok)
          throw new Error(
            response.status === 401 || response.status === 403
              ? '请以教师身份进入平台后查看提醒。'
              : '提醒读取失败，请稍后重试。',
          );
        const body = (await response.json()) as { events?: ScheduleEvent[] };
        if (cancelled || refreshQueued) return;
        const next = body.events ?? [];
        const receivedAt = Date.now();
        const nextIds = new Set(next.map((event) => event.id));
        for (const id of visibleIds) if (!nextIds.has(id)) toast.dismiss(`schedule:${id}`);
        visibleIds = nextIds;
        const stored = readReceipts();
        receipts = {
          seen: [...new Set([...receipts.seen, ...stored.seen])],
          read: [...new Set([...receipts.read, ...stored.read])],
        };
        const incoming = next.filter((event) => !receipts.seen.includes(event.id));
        receipts.seen = [...new Set([...receipts.seen, ...nextIds])].slice(-500);
        persistReceipts(receipts);
        setReadIds(receipts.read);
        setEvents(next);
        setNow(time);
        setError('');
        for (const event of incoming) {
          const due = event.remindAt ?? event.fireAt;
          if (due > receivedAt || receivedAt - due > 120_000 || event.fireAt < receivedAt - 120_000)
            continue;
          toast(event.title, {
            id: `schedule:${event.id}`,
            description: [formatEventTime(event.fireAt), event.location]
              .filter(Boolean)
              .join(' · '),
            action: event.classroomUrl
              ? {
                  label: t('platform.reminders.enter'),
                  onClick: () => router.push(event.classroomUrl!),
                }
              : undefined,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '提醒读取失败。');
      } finally {
        running = false;
        if (refreshQueued && !cancelled) {
          refreshQueued = false;
          void poll();
        }
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    const unsubscribe = subscribeScheduleChanges(() => void poll());
    const onStorage = (event: StorageEvent) => {
      if (event.key === RECEIPTS_KEY) setReadIds(readReceipts().read);
    };
    void poll();
    const timer = setInterval(() => void poll(), 10_000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      for (const id of visibleIds) toast.dismiss(`schedule:${id}`);
      clearInterval(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled, router, t]);
  const markAllRead = useCallback(() => {
    const receipts = readReceipts();
    receipts.read = [...new Set([...receipts.read, ...events.map((event) => event.id)])].slice(
      -500,
    );
    persistReceipts(receipts);
    setReadIds(receipts.read);
  }, [events]);
  return enabled
    ? {
        events,
        error,
        markAllRead,
        unreadCount: events.filter(
          (event) => event.fireAt > now - 3_600_000 && !readIds.includes(event.id),
        ).length,
      }
    : empty;
}
export function useScheduleEvents(enabled: boolean) {
  const value = useContext(ScheduleReminderContext);
  return enabled ? value : empty;
}
