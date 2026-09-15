'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { useI18n } from '@/lib/hooks/use-i18n';
import { notifyScheduleChanged, subscribeScheduleChanges } from '@/lib/platform/schedule/client-events';

export interface ScheduleItem {
  id: string;
  title: string;
  location: string | null;
  rrule: string;
  start_at: number;
  duration_min: number;
  classroom_url: string | null;
  remind_before_min: number;
  enabled: boolean | number;
}

export interface ScheduleDraft {
  id?: string;
  title: string;
  location?: string;
  rrule: string;
  start_at: number;
  duration_min?: number;
  classroom_url?: string;
  remind_before_min?: number;
  enabled?: boolean;
}

export function isScheduleEnabled(item: ScheduleItem): boolean {
  return item.enabled !== false && item.enabled !== 0;
}

async function scheduleCall<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error ?? `schedule_${response.status}`);
  return body as T;
}

export function useSchedule() {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [error, setError] = useState('');

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const unsubscribe = subscribeScheduleChanges(reload);
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    const timer = setInterval(onVisible, 30_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { unsubscribe(); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    scheduleCall<{ items?: ScheduleItem[] }>('/api/platform/schedule')
      .then((body) => {
        if (cancelled) return;
        setItems(body.items ?? []);
        setError('');
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '日程读取失败，请重试。');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const fail = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'teacher_required') {
        toast.error(message, {
          action: {
            label: t('platform.student.goToPortal'),
            onClick: () => router.push('/portal'),
          },
        });
        return;
      }
      toast.error(message);
    },
    [router, t],
  );

  const save = useCallback(
    async (item: ScheduleDraft): Promise<boolean> => {
      try {
        await scheduleCall('/api/platform/schedule', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(item),
        });
        notifyScheduleChanged();
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
    },
    [fail, reload],
  );

  const patch = useCallback(
    async (id: string, partial: Partial<ScheduleDraft>): Promise<boolean> => {
      try {
        await scheduleCall('/api/platform/schedule', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, ...partial }),
        });
        notifyScheduleChanged();
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
    },
    [fail, reload],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await scheduleCall(`/api/platform/schedule?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        notifyScheduleChanged();
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
    },
    [fail, reload],
  );

  return { items, loading, error, reload, save, patch, remove };
}
