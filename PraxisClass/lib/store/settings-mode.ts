import { create } from 'zustand';
import type { PlatformMode } from '@/lib/types/settings';

function initialMode(): PlatformMode {
  if (typeof window === 'undefined' || !window.location) return 'teacher';
  if (window.location.pathname.startsWith('/student')) return 'student';
  if (
    ['/teacher', '/dashboard', '/knowledge', '/schedule'].some((path) =>
      window.location.pathname.startsWith(path),
    )
  )
    return 'teacher';
  try {
    return window.sessionStorage.getItem('praxis-settings-mode') === 'student'
      ? 'student'
      : 'teacher';
  } catch {
    return 'teacher';
  }
}

export const useSettingsMode = create<{
  mode: PlatformMode;
  setMode: (mode: PlatformMode) => void;
}>((set) => ({
  mode: initialMode(),
  setMode: (mode) => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.setItem('praxis-settings-mode', mode);
      } catch {
        /* In-memory role remains isolated. */
      }
    }
    set({ mode });
  },
}));

// Tag only this app's API requests; external requests receive no role metadata.
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const host = window as typeof window & { __praxisRoleFetch?: { mode: () => PlatformMode } };
  if (host.__praxisRoleFetch) host.__praxisRoleFetch.mode = () => useSettingsMode.getState().mode;
  else {
    const originalFetch = window.fetch.bind(window);
    const scope = { mode: () => useSettingsMode.getState().mode };
    host.__praxisRoleFetch = scope;
    window.fetch = (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.origin,
      );
      if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/'))
        return originalFetch(input, init);
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      headers.set('x-praxis-role', scope.mode());
      return originalFetch(input, { ...init, headers });
    };
  }
}
