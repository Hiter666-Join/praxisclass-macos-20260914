'use client';

import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import type { Scene } from '@/lib/types/stage';
import { getSceneTypeMeta, resolvePathStepState } from '@/lib/classroom/scene-type-meta';

export type LearningPathTrailingSlot = 'generating' | 'paused' | 'failed' | 'complete' | null;

export function learningPathTrailingLabel(slot: Exclude<LearningPathTrailingSlot, null>) {
  if (slot === 'complete') return 'classroomPath.completeStep';
  if (slot === 'failed') return 'stage.generationFailed';
  if (slot === 'paused') return 'stage.paused';
  return 'classroomPath.generatingStep';
}

interface LearningPathBarProps {
  readonly scenes: readonly Scene[];
  readonly currentSceneId: string | null;
  /** The pending slot (generating / completion page) is the current page. */
  readonly pendingActive?: boolean;
  readonly trailingSlot?: LearningPathTrailingSlot;
  readonly onSelect?: (sceneId: string) => void;
  readonly onSelectPending?: () => void;
  readonly className?: string;
}

/**
 * Segmented learning-path progress: one segment per page, coloured by page
 * type, clickable to jump. Lives in the classroom header so the whole route
 * (讲解 → 实操 → 任务 → 测验) stays visible while a page plays.
 */
export function LearningPathBar({
  scenes,
  currentSceneId,
  pendingActive,
  trailingSlot,
  onSelect,
  onSelectPending,
  className,
}: LearningPathBarProps) {
  const { t } = useI18n();
  const currentIndex = pendingActive
    ? scenes.length
    : scenes.findIndex((scene) => scene.id === currentSceneId);
  const total = scenes.length + (trailingSlot ? 1 : 0);
  const current = currentIndex >= 0 ? currentIndex + 1 : 0;

  return (
    <nav
      data-classroom-path
      aria-label={t('classroomPath.title')}
      className={cn('flex min-w-0 items-center gap-3', className)}
    >
      <ol className="flex min-w-0 flex-1 items-center gap-1">
          {scenes.map((scene, index) => {
            const meta = getSceneTypeMeta(scene.type);
            const state = resolvePathStepState(index, currentIndex);
            return (
              <li key={scene.id} data-scene-tone={meta.tone} className="flex min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onSelect?.(scene.id)}
                  aria-current={state === 'current' ? 'step' : undefined}
                  aria-label={`${t('classroomPath.pageNumber', { number: index + 1 })} · ${scene.title}`}
                  title={`${index + 1}. ${t(meta.labelKey)} · ${scene.title}`}
                  className="group flex h-6 w-full cursor-pointer items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'block w-full rounded-full transition-[height,opacity] duration-200',
                      state === 'current' &&
                        'h-2 bg-(--scene-tone) shadow-[0_0_0_3px_var(--scene-tone-soft)]',
                      state === 'done' && 'h-1.5 bg-(--scene-tone) opacity-60 group-hover:opacity-90',
                      state === 'upcoming' &&
                        'h-1.5 border border-(--scene-tone)/35 bg-(--scene-tone-soft) group-hover:border-(--scene-tone)/70',
                    )}
                  />
                </button>
              </li>
            );
          })}
          {trailingSlot && (
            <li className="flex w-6 shrink-0">
              <button
                type="button"
                onClick={onSelectPending}
                disabled={!onSelectPending}
                aria-current={pendingActive ? 'step' : undefined}
                title={t(learningPathTrailingLabel(trailingSlot))}
                className="flex h-6 w-full items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
              >
                <span
                  className={cn(
                    'block w-full rounded-full',
                    pendingActive
                      ? 'h-2 bg-primary shadow-[0_0_0_3px_var(--accent)]'
                      : 'h-1.5 border border-border bg-muted',
                    trailingSlot === 'generating' && !pendingActive && 'animate-pulse',
                  )}
                />
              </button>
            </li>
          )}
      </ol>
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {t('classroomPath.progress', { current, total })}
      </span>
    </nav>
  );
}
