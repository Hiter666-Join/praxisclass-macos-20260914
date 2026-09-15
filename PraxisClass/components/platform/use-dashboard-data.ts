'use client';

import { useCallback, useEffect, useState } from 'react';

import type { DashboardPayload } from '@/lib/platform/analytics/aggregate';
import type { RecordKind } from '@/lib/platform/record-context';

import { useLearnerKey } from './use-learner-key';

interface DashboardState {
  data: DashboardPayload | null;
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

export function useDashboard(
  scope: 'all' | 'self',
  recordKind: RecordKind = 'learning',
): DashboardState {
  const learnerKey = useLearnerKey();
  const [result, setResult] = useState<{ key: string; data: DashboardPayload | null } | null>(null);
  const [nonce, setNonce] = useState(0);
  const requestKey = JSON.stringify([scope, learnerKey, recordKind, nonce]);

  const refresh = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (scope === 'self' && !learnerKey) return;
    let cancelled = false;
    fetch(`/api/platform/dashboard?scope=${scope}&recordKind=${recordKind}`, {
      headers: scope === 'self' && learnerKey ? { 'x-learner-key': learnerKey } : undefined,
    })
      .then((response) => (response.ok ? (response.json() as Promise<DashboardPayload>) : null))
      .then((payload) => {
        if (cancelled) return;
        setResult({ key: requestKey, data: payload });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ key: requestKey, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [scope, learnerKey, requestKey, recordKind]);

  const current = result?.key === requestKey ? result : null;
  return {
    data: current?.data ?? null,
    loading: current === null,
    error: current !== null && current.data === null,
    refresh,
  };
}
