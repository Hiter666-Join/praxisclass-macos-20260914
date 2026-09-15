'use client';

import { useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSceneTypeMeta } from '@/lib/classroom/scene-type-meta';
import { SceneRenderer } from '@/components/stage/scene-renderer';
import { SceneProvider } from '@/lib/contexts/scene-context';
import { Whiteboard } from '@/components/whiteboard';
import { CanvasToolbar } from '@/components/canvas/canvas-toolbar';
import type { CanvasToolbarProps } from '@/components/canvas/canvas-toolbar';
import type { Scene, StageMode } from '@/lib/types/stage';
import { useI18n } from '@/lib/hooks/use-i18n';
import { ClassroomCompletePageConnected } from '@/components/scene-renderers/classroom-complete';
import { ContainBox } from '@/components/edit/ContainBox';
import { useInWorkbenchPanel } from '@/lib/workbench/panel-context';
import type { PPTElement } from '@praxis/dsl';
import { SlideElementPickOverlay } from '@/components/canvas/slide-element-pick-overlay';

interface CanvasAreaProps extends CanvasToolbarProps {
  readonly currentScene: Scene | null;
  readonly mode: StageMode;
  readonly hideToolbar?: boolean;
  readonly isPendingScene?: boolean;
  readonly isCourseComplete?: boolean;
  readonly isGenerationFailed?: boolean;
  readonly onRetryGeneration?: () => void;
  readonly elementPickActive?: boolean;
  readonly onPickElement?: (element: PPTElement) => void;
  readonly onCancelElementPick?: () => void;
  /** Restart the course from its first page, from the completion card. */
  readonly onReplayCourse?: () => void;
}

export function CanvasArea({
  currentScene,
  currentSceneIndex,
  scenesCount,
  mode,
  engineState,
  isLiveSession,
  isSoftClosing,
  softCloseDeadline,
  whiteboardOpen,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  onWhiteboardClose,
  isPresenting,
  onTogglePresentation,
  showStopDiscussion,
  onStopDiscussion,
  onContinueDiscussion,
  hideToolbar,
  isPendingScene,
  isCourseComplete,
  isGenerationFailed,
  onRetryGeneration,
  elementPickActive,
  onPickElement,
  onCancelElementPick,
  onReplayCourse,
}: CanvasAreaProps) {
  const { t } = useI18n();
  const inWorkbenchPanel = useInWorkbenchPanel();
  const showControls = mode === 'playback' && !whiteboardOpen;
  const showPlayHint =
    showControls &&
    engineState !== 'playing' &&
    currentScene?.type === 'slide' &&
    !isLiveSession &&
    !isPendingScene;

  // Page-type corner marker: tells the learner which kind of page they are on
  // with the same tone palette the learning path and the class record use.
  const sceneMeta = getSceneTypeMeta(currentScene?.type);
  const PageTypeIcon = sceneMeta.icon;
  const showPageBadge = showControls && !!currentScene && !isPresenting && !isPendingScene;

  const handleSlideClick = useCallback(
    (e: React.MouseEvent) => {
      if (!showControls || isLiveSession || currentScene?.type !== 'slide') return;
      // Don't trigger page play/pause when clicking inside a video element's visual area.
      // Video elements may be visually covered by other slide elements (e.g. text),
      // so we check click coordinates against all video element bounding rects.
      const container = e.currentTarget as HTMLElement;
      const videoEls = container.querySelectorAll('[data-video-element]');
      for (const el of videoEls) {
        const rect = el.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          return;
        }
      }
      onPlayPause();
    },
    [showControls, isLiveSession, onPlayPause, currentScene?.type],
  );

  return (
    <div className="w-full h-full flex flex-col bg-background group/canvas">
      {/* Slide area — takes remaining space */}
      <div
        className={cn(
          'flex-1 min-h-0 relative overflow-hidden flex items-center justify-center bg-muted/30 p-2 sm:p-4',
        )}
      >
        <StageViewport
          workbench={inWorkbenchPanel}
          interactive={currentScene?.type === 'interactive'}
          className={cn(
            'bg-white dark:bg-gray-800 shadow-sm rounded-xl overflow-hidden relative ring-1 ring-border',
            showControls && !isLiveSession && currentScene?.type === 'slide' && 'cursor-pointer',
          )}
          onClick={handleSlideClick}
        >
          {/* Whiteboard Layer */}
          <div className="absolute inset-0 z-[110] pointer-events-none">
            <SceneProvider>
              <Whiteboard isOpen={whiteboardOpen} onClose={onWhiteboardClose} />
            </SceneProvider>
          </div>

          {/* Scene Content */}
          {currentScene && !whiteboardOpen && (
            <div className="absolute inset-0">
              <SceneProvider>
                <SceneRenderer scene={currentScene} mode={mode} />
              </SceneProvider>
            </div>
          )}

          {/* Page-type corner marker */}
          {showPageBadge && (
            <div
              data-scene-tone={sceneMeta.tone}
              data-canvas-page-badge
              className="pointer-events-none absolute right-2.5 top-2.5 z-[103] flex items-center gap-1.5 rounded-full border border-border/70 bg-card/85 px-2.5 py-1 shadow-sm backdrop-blur-sm"
            >
              <PageTypeIcon className="size-3.5 text-(--scene-tone)" aria-hidden="true" />
              <span className="text-[11px] font-semibold leading-none text-(--scene-tone)">
                {t(sceneMeta.labelKey)}
              </span>
              <span aria-hidden="true" className="text-[11px] leading-none text-muted-foreground/50">
                ·
              </span>
              <span className="text-[11px] font-medium leading-none tabular-nums text-muted-foreground">
                {t('classroomPath.pageNumber', { number: currentSceneIndex + 1 })}
              </span>
            </div>
          )}

          {elementPickActive &&
            onPickElement &&
            onCancelElementPick &&
            currentScene?.type === 'slide' &&
            currentScene.content.type === 'slide' && (
              <SlideElementPickOverlay
                scene={currentScene}
                onPick={onPickElement}
                onCancel={onCancelElementPick}
              />
            )}

          {/* Pending Scene Loading / Completion Overlay */}
          <AnimatePresence>
            {isPendingScene && !currentScene && isCourseComplete && (
              <motion.div
                key="course-complete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="absolute inset-0"
              >
                <ClassroomCompletePageConnected onReplay={onReplayCourse} />
              </motion.div>
            )}
            {isPendingScene && !currentScene && !isCourseComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="absolute inset-0 z-[105] flex flex-col items-center justify-center bg-card px-8"
              >
                {isGenerationFailed ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                      <AlertTriangle className="size-6" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-medium text-destructive">
                      {t('stage.generationFailed')}
                    </span>
                    {onRetryGeneration && (
                      <button
                        onClick={onRetryGeneration}
                        className="mt-1 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15 active:scale-95"
                      >
                        {t('generation.retryScene')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex w-full max-w-md flex-col items-center">
                    {/* Page skeleton — the shape of the slide being written */}
                    <div className="w-full space-y-3" aria-hidden="true">
                      <div className="h-2.5 w-1/4 animate-pulse rounded-full bg-muted" />
                      <div className="h-6 w-3/5 animate-pulse rounded-lg bg-muted" />
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="col-span-2 h-24 animate-pulse rounded-xl bg-muted" />
                        <div className="h-24 animate-pulse rounded-xl bg-muted" />
                      </div>
                      <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
                      <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-muted" />
                    </div>
                    {/* Text */}
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      className="mt-7 flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                      <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                      {t('stage.generatingNextPage')}
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Play hint — breathing button when idle or paused (slides only) */}
          <AnimatePresence>
            {showPlayHint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-[102] flex items-center justify-center pointer-events-none"
              >
                <motion.div
                  className="opacity-50 group-hover/canvas:opacity-100 transition-opacity duration-300 pointer-events-auto cursor-pointer"
                  exit={{ pointerEvents: 'none' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayPause();
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.85 }}
                    animate={{ scale: [1, 1.06] }}
                    exit={{ scale: 1.15, opacity: 0 }}
                    transition={{
                      default: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                      scale: {
                        repeat: Infinity,
                        repeatType: 'mirror',
                        duration: 1,
                        ease: 'easeInOut',
                      },
                    }}
                    className="flex size-20 items-center justify-center rounded-full bg-card/95 ring-1 ring-primary/25 shadow-[0_4px_30px_rgb(198_79_60/18%)] dark:shadow-[0_4px_30px_rgb(0_0_0/45%)]"
                    style={{ willChange: 'transform' }}
                  >
                    <Play className="ml-0.5 size-7 fill-primary/90 text-primary" />
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </StageViewport>
      </div>

      {/* ── Canvas Toolbar — in document flow, only when not merged into roundtable ── */}
      {!hideToolbar && (
        <CanvasToolbar
          className={cn('shrink-0 min-h-11 px-2 bg-card border-t border-border')}
          currentSceneIndex={currentSceneIndex}
          scenesCount={scenesCount}
          engineState={engineState}
          isLiveSession={isLiveSession}
          isSoftClosing={isSoftClosing}
          softCloseDeadline={softCloseDeadline}
          whiteboardOpen={whiteboardOpen}
          sidebarCollapsed={sidebarCollapsed}
          chatCollapsed={chatCollapsed}
          onToggleSidebar={onToggleSidebar}
          onToggleChat={onToggleChat}
          onPrevSlide={onPrevSlide}
          onNextSlide={onNextSlide}
          onPlayPause={onPlayPause}
          onWhiteboardClose={onWhiteboardClose}
          isPresenting={isPresenting}
          onTogglePresentation={onTogglePresentation}
          showStopDiscussion={showStopDiscussion}
          onStopDiscussion={onStopDiscussion}
          onContinueDiscussion={onContinueDiscussion}
        />
      )}
    </div>
  );
}

function StageViewport({
  workbench,
  interactive,
  className,
  onClick,
  children,
}: {
  readonly workbench: boolean;
  readonly interactive: boolean;
  readonly className?: string;
  readonly onClick?: (event: React.MouseEvent) => void;
  readonly children: ReactNode;
}) {
  if (interactive) {
    return (
      <div className={cn('h-full w-full', className)} onClick={onClick}>
        {children}
      </div>
    );
  }
  if (!workbench) {
    return (
      <div
        className={cn('aspect-[16/9] h-full max-h-full max-w-full', className)}
        onClick={onClick}
      >
        {children}
      </div>
    );
  }
  return (
    <ContainBox fit="contain" className={className}>
      <div className="relative h-full w-full" onClick={onClick}>
        {children}
      </div>
    </ContainBox>
  );
}
