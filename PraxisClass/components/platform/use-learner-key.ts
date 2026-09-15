'use client';

import { useEffect, useState } from 'react';

import { getLearnerKey } from '@/lib/runtime/learner-key';
import { useSettingsMode } from '@/lib/store/settings-mode';

/** The device-anonymous learner key, resolved on the client after mount. */
export function useLearnerKey(): string | null {
  const mode = useSettingsMode((s) => s.mode);
  const [resolved, setResolved] = useState<{ mode: typeof mode; key: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getLearnerKey()
      .then((key) => {
        if (!cancelled) setResolved({ mode, key });
      })
      .catch(() => {
        // Storage unavailable: callers fall back to their unauthenticated path.
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return resolved?.mode === mode ? resolved.key : null;
}
