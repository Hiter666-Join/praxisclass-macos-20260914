'use client';

/**
 * The three states a classroom shows before (or instead of) the stage:
 * loading, course-not-found and load-error. Both hosts — the `/classroom/[id]`
 * route and the workspace pane's `ClassroomSurface` — render these, so the
 * screens stay identical wherever the classroom is mounted.
 */

import Link from 'next/link';
import { AlertTriangle, FileQuestion, Home, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';

const PRIMARY_ACTION =
  'inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring';

/** Course still loading: a skeleton of the classroom's three columns. */
export function ClassroomLoadingState() {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 items-center justify-center p-6" role="status">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="flex w-full gap-2" aria-hidden="true">
          {/* learning path */}
          <div className="h-32 w-16 animate-pulse rounded-xl bg-muted" />
          {/* canvas + podium */}
          <div className="flex-1 space-y-2">
            <div className="h-[4.75rem] animate-pulse rounded-xl bg-muted" />
            <div className="h-[3.25rem] animate-pulse rounded-xl bg-muted" />
          </div>
          {/* class record */}
          <div className="h-32 w-14 animate-pulse rounded-xl bg-muted" />
        </div>
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          {t('common.loadingClassroom')}
        </p>
      </div>
    </div>
  );
}

/**
 * The course is gone: every source answered and none has it. No retry — the
 * same lookups cannot change the answer.
 */
export function ClassroomNotFoundState() {
  const { t } = useI18n();
  return (
    <div
      className="flex flex-1 items-center justify-center p-6"
      data-testid="classroom-not-found"
    >
      <div className="workspace-panel w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <FileQuestion className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-lg font-semibold text-foreground">{t('classroom.notFound')}</p>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {t('classroom.notFoundDesc')}
        </p>
        <Link href="/" className={`mt-6 ${PRIMARY_ACTION}`}>
          <Home className="size-4" aria-hidden="true" />
          {t('classroom.backToHome')}
        </Link>
      </div>
    </div>
  );
}

/** The load failed for a reason that may not repeat: offer another attempt. */
export function ClassroomErrorState({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="workspace-panel w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm leading-6 text-destructive" role="alert">
          {t('common.errorPrefix')}
          {message}
        </p>
        <button type="button" onClick={onRetry} className={`mt-6 ${PRIMARY_ACTION}`}>
          {t('common.retry')}
        </button>
      </div>
    </div>
  );
}
