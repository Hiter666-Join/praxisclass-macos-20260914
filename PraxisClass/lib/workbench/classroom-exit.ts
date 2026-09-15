import type { PlatformMode } from '@/lib/types/settings';

export type ClassroomExitDecision = {
  readonly kind: 'push';
  readonly href: '/workspace' | '/student' | '/';
};

interface ClassroomExitContext {
  readonly searchParams: Pick<URLSearchParams, 'get'>;
  readonly platformMode?: PlatformMode;
}

interface ClassroomExitRouter {
  readonly push: (href: string) => void;
}

/**
 * Resolve where a standalone classroom should exit without depending on
 * browser globals, so direct links and SSR callers get the same safe default.
 *
 * A classic classroom exits to the current side's home. The previous history entry is
 * often an entry-time flow (generation-preview) that is not a return target —
 * backing into it shows a dead "no generation in progress" page — so browser
 * history is never used for the classic arrow. Students return to their course
 * page; the classic authoring entry remains the teacher default. Workbench-attached classrooms get a different
 * destination, via their explicit URL contract (`from=workspace` /
 * `returnTo=home`).
 */
export function resolveClassroomExit({
  searchParams,
  platformMode,
}: ClassroomExitContext): ClassroomExitDecision {
  // An explicit source wins over history: classroom state changes may push
  // intermediate entries onto the stack, while `from` survives refreshes and
  // does not depend on browser-specific history behaviour.
  if (searchParams.get('from') === 'workspace') {
    return { kind: 'push', href: '/workspace' };
  }
  const homeHref = platformMode === 'student' ? '/student' : '/';
  // Leaving Pro playback opens the ordinary classroom with an explicit home
  // return contract. Browser history still contains the Pro workspace, so
  // without this rule the home arrow would contradict the workspace link.
  if (searchParams.get('returnTo') === 'home') {
    return { kind: 'push', href: homeHref };
  }
  return { kind: 'push', href: homeHref };
}

/** Resolve against the current browser, then perform the selected exit. */
export function exitClassroom(
  router: ClassroomExitRouter,
  searchParams: Pick<URLSearchParams, 'get'>,
  platformMode?: PlatformMode,
): void {
  router.push(resolveClassroomExit({ searchParams, platformMode }).href);
}

export function classroomExitLabelKey(
  searchParams: Pick<URLSearchParams, 'get'>,
  platformMode?: PlatformMode,
): 'workbench.common.backToWorkspace' | 'platform.backToPlatform' | 'generation.backToHome' {
  const { href } = resolveClassroomExit({ searchParams, platformMode });
  if (href === '/workspace') return 'workbench.common.backToWorkspace';
  return href === '/student' ? 'platform.backToPlatform' : 'generation.backToHome';
}

export function classroomEntryHref(stageId: string, discoverOnly: boolean): string {
  const href = `/classroom/${stageId}`;
  return discoverOnly ? `${href}?from=workspace` : href;
}
