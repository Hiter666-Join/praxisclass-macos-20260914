'use client';

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useRouter, useSearchParams } from 'next/navigation';
import type { StageMode } from '@/lib/types/stage';
import { classroomExitLabelKey, exitClassroom } from '@/lib/workbench/classroom-exit';
import { saveBeforeLeaving } from '@/lib/edit/classroom-save';
import { getSceneTypeMeta } from '@/lib/classroom/scene-type-meta';
import { PENDING_SCENE_ID } from '@/lib/store/stage';
import { useStageStore } from '@/lib/store';
import { useSettingsStore } from '@/lib/store/settings';
import { HeaderControls } from './stage/header-controls';
import { ClassroomTimingTools } from './stage/classroom-timing-tools';
import {
  LearningPathBar,
  learningPathTrailingLabel,
  type LearningPathTrailingSlot,
} from './stage/learning-path-bar';

interface HeaderProps {
  readonly currentSceneTitle: string;
  readonly mode?: StageMode;
  readonly proModeActive?: boolean;
  readonly canEdit?: boolean;
  readonly onToggleEditMode?: () => void;
  /** Replaces the default back-to-home arrow as the header's leftmost
      control. `PlaybackChromeRoot` passes the workbench's return control
      here while a session is attached and full-screen playback is on, so the
      top-left back affordance becomes the back-to-workspace control instead of a home arrow
      (which would navigate away from the hosted classroom entirely). */
  readonly backControl?: ReactNode;
  /** Drops the back slot entirely (no `backControl`, no home arrow). The
      embedded workbench form uses this: the conversation sits beside/above
      the classroom, so any back affordance here would duplicate the chat's
      own back and could exit the workbench. */
  readonly hideBackControl?: boolean;
  /** Hide application-global controls in a workbench-attached classroom. */
  readonly hideGlobalControls?: boolean;
  /** Hide course-level share/export in a workbench-attached classroom. */
  readonly hideCourseActions?: boolean;
  /** Jump handler for the learning-path bar. `PlaybackChromeRoot` passes its
      gated scene switch so a jump mid-discussion asks for confirmation first;
      without it the header switches the store directly. */
  readonly onSceneSelect?: (sceneId: string) => unknown;
  /** Every outline has materialised: the path ends in a completion step. */
  readonly isCourseComplete?: boolean;
}

export function Header({
  currentSceneTitle,
  mode,
  proModeActive,
  canEdit,
  onToggleEditMode,
  backControl,
  hideBackControl,
  hideGlobalControls,
  hideCourseActions,
  onSceneSelect,
  isCourseComplete,
}: HeaderProps) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const platformMode = useSettingsStore((state) => state.mode);
  const exitLabel = t(classroomExitLabelKey(searchParams, platformMode));
  const courseName = useStageStore((state) => state.stage?.name);
  const scenes = useStageStore((state) => state.scenes);
  const currentSceneId = useStageStore((state) => state.currentSceneId);
  const generatingOutlines = useStageStore((state) => state.generatingOutlines);
  const failedOutlines = useStageStore((state) => state.failedOutlines);
  const generationStatus = useStageStore((state) => state.generationStatus);
  const setCurrentSceneId = useStageStore((state) => state.setCurrentSceneId);

  const isPendingScene = currentSceneId === PENDING_SCENE_ID;
  const currentScene = isPendingScene
    ? undefined
    : scenes.find((scene) => scene.id === currentSceneId);
  const trailingSlot: LearningPathTrailingSlot =
    generatingOutlines.length > 0
      ? failedOutlines.some((outline) => outline.id === generatingOutlines[0].id)
        ? 'failed'
        : generationStatus === 'paused'
          ? 'paused'
          : 'generating'
      : isCourseComplete
        ? 'complete'
        : null;
  const typeMeta = currentScene ? getSceneTypeMeta(currentScene.type) : null;
  const TypeIcon = typeMeta?.icon;
  const selectScene = onSceneSelect ?? setCurrentSceneId;
  const showPath = mode !== 'edit' && scenes.length > 0;

  return (
    <header
      data-classroom-header
      className="z-10 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/70 px-4 py-2.5 sm:px-5"
    >
      {/* Title column: course · page type / page title / learning path. The
          path sits under the title rather than in its own row so the header
          keeps the baseline height even when both side panels are open and
          the main column is narrow. */}
      <div className="flex min-w-0 flex-1 basis-72 items-start gap-3">
        {hideBackControl
          ? null
          : (backControl ?? (
              <button
                onClick={() => void saveBeforeLeaving(() => exitClassroom(router, searchParams, platformMode))}
                className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                title={exitLabel}
                aria-label={exitLabel}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ))}
        {/* Title block — hidden when `mode === 'edit'`. Header lives
            inside `PlaybackChromeRoot`, which is unmounted by `Stage`
            once mode flips to 'edit', so in steady state this branch
            is always taken. The guard exists for the ~280ms
            AnimatePresence exit window where the playback chrome
            is still rendering its exit animation while `mode` has
            already flipped — without the guard, this title would
            briefly stack on top of the incoming EditChromeRoot's
            CommandBar title during the cross-fade. */}
        {mode !== 'edit' && (
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">
                {courseName || t('platform.design.classroomWorkspace')}
              </span>
              {typeMeta && TypeIcon && (
                <span
                  data-scene-tone={typeMeta.tone}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-(--scene-tone-soft) px-1.5 py-0.5 text-[11px] font-medium leading-4 text-(--scene-tone)"
                >
                  <TypeIcon className="size-3" aria-hidden="true" />
                  {t(typeMeta.labelKey)}
                </span>
              )}
              {isPendingScene && trailingSlot && (
                <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-medium leading-4 text-accent-foreground">
                  {t(learningPathTrailingLabel(trailingSlot))}
                </span>
              )}
            </div>
            <h1
              className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg"
              suppressHydrationWarning
            >
              {currentSceneTitle ||
                (isPendingScene && generatingOutlines[0]?.title) ||
                t('common.loading')}
            </h1>
            {showPath && (
              <LearningPathBar
                scenes={scenes}
                currentSceneId={currentSceneId}
                pendingActive={isPendingScene}
                trailingSlot={trailingSlot}
                onSelect={(sceneId) => void selectScene(sceneId)}
                onSelectPending={
                  trailingSlot ? () => void selectScene(PENDING_SCENE_ID) : undefined
                }
                className="mt-1 w-full max-w-md"
              />
            )}
          </div>
        )}
      </div>

      {/* Standalone classroom keeps the full cluster. Workbench-attached
          classrooms omit both the global capsule and course share/export. */}
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2.5">
        {!hideGlobalControls && <ClassroomTimingTools />}
        <HeaderControls
          mode={mode}
          proModeActive={proModeActive}
          canEdit={canEdit}
          onToggleEditMode={onToggleEditMode}
          showGlobalControls={!hideGlobalControls}
          showCourseActions={!hideCourseActions}
        />
      </div>
    </header>
  );
}
