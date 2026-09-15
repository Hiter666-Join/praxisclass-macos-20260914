'use client';

import { useSyncExternalStore } from 'react';
import { X } from 'lucide-react';

import { useI18n } from '@/lib/hooks/use-i18n';

const DISMISS_KEY = 'praxis.aiNoticeDismissed';

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

let dismissedThisLoad = false;

function readDismissed(): boolean {
  if (dismissedThisLoad) return true;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** The server cannot read the visitor's choice, so the notice renders by default. */
function serverDismissed(): boolean {
  return false;
}

function dismiss(): void {
  dismissedThisLoad = true;
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Nothing persists; the notice returns on the next load.
  }
  for (const listener of listeners) listener();
}

export function AiNotice() {
  const { t } = useI18n();
  const dismissed = useSyncExternalStore(subscribe, readDismissed, serverDismissed);

  if (dismissed) return null;

  return (
    <div
      data-ai-notice
      className="fixed bottom-2 left-2 right-2 z-40 flex min-h-11 items-center gap-2 rounded-xl border bg-background px-3 py-1.5 text-xs leading-5 text-muted-foreground shadow-sm sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm"
    >
      <span className="min-w-0">{t('platform.aiNotice')}</span>
      <button
        type="button"
        aria-label={t('platform.aiNoticeDismiss')}
        className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={dismiss}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
