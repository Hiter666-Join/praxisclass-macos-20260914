'use client';

import { useState, useRef, useCallback, type KeyboardEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  Globe,
  LayoutGrid,
  List,
  Loader2,
  PanelLeftClose,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlideThumbnail } from '@/components/slide-renderer/SlideThumbnail';
import { ThumbnailInteractive } from '@/components/slide-renderer/components/ThumbnailInteractive';
import { useStageStore, useCanvasStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useNearViewport } from '@/lib/hooks/use-near-viewport';
import type { Scene, SlideContent, InteractiveContent } from '@/lib/types/stage';
import { PENDING_SCENE_ID } from '@/lib/store/stage';
import {
  getSceneTypeMeta,
  resolvePathStepState,
  type SceneTypeMeta,
} from '@/lib/classroom/scene-type-meta';

interface SceneSidebarProps {
  readonly collapsed: boolean;
  readonly onCollapseChange: (collapsed: boolean) => void;
  readonly onSceneSelect?: (sceneId: string) => void;
  readonly onRetryOutline?: (outlineId: string) => Promise<void>;
  readonly isCourseComplete?: boolean;
}

const DEFAULT_WIDTH = 252;
const MIN_WIDTH = 184;
const MAX_WIDTH = 400;

/** Shared shell of every timeline row (pages, the generating slot, the end). */
const STEP_ROW =
  'group relative flex gap-2.5 rounded-xl py-2 pl-1.5 pr-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring';
const STEP_ROW_ACTIVE = 'bg-card shadow-sm ring-1 ring-border/70';
const STEP_ROW_IDLE = 'hover:bg-card/70';

function activateOnKey(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    action();
  }
}

/**
 * Left column of a timeline row: the connector line plus the step node. The
 * line overshoots the row's vertical padding so consecutive rows read as one
 * continuous rail; the first and last rows stop it at their node.
 */
function StepRail({
  first,
  last,
  nodeClassName,
  children,
}: {
  readonly first: boolean;
  readonly last: boolean;
  readonly nodeClassName: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="relative flex w-7 shrink-0 justify-center">
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-1/2 w-px -translate-x-1/2 bg-border',
          first ? 'top-4' : '-top-2',
          last ? 'bottom-[calc(100%-1rem)]' : '-bottom-2',
        )}
      />
      <span
        className={cn(
          'relative z-[1] mt-0.5 flex size-6 items-center justify-center rounded-full transition-colors',
          nodeClassName,
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function SceneSidebar({
  collapsed,
  onCollapseChange,
  onSceneSelect,
  onRetryOutline,
  isCourseComplete,
}: SceneSidebarProps) {
  const { t } = useI18n();
  const { scenes, currentSceneId, setCurrentSceneId, generatingOutlines, generationStatus } =
    useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();
  const viewportSize = useCanvasStore.use.viewportSize();
  const viewportRatio = useCanvasStore.use.viewportRatio();

  const [retryingOutlineId, setRetryingOutlineId] = useState<string | null>(null);

  const handleRetryOutline = async (outlineId: string) => {
    if (!onRetryOutline) return;
    setRetryingOutlineId(outlineId);
    try {
      await onRetryOutline(outlineId);
    } finally {
      setRetryingOutlineId(null);
    }
  };

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const isDraggingRef = useRef(false);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const handleMouseMove = (me: MouseEvent) => {
        const delta = me.clientX - startX;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        setSidebarWidth(newWidth);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [sidebarWidth],
  );

  const selectScene = (sceneId: string) => {
    if (onSceneSelect) onSceneSelect(sceneId);
    else setCurrentSceneId(sceneId);
  };

  const isPendingActive = currentSceneId === PENDING_SCENE_ID;
  const hasGeneratingSlot = generatingOutlines.length > 0;
  const hasCompleteSlot = !!isCourseComplete && !hasGeneratingSlot;
  const hasTrailingSlot = hasGeneratingSlot || hasCompleteSlot;
  const currentIndex = isPendingActive
    ? scenes.length
    : scenes.findIndex((scene) => scene.id === currentSceneId);
  const total = scenes.length + (hasTrailingSlot ? 1 : 0);
  const current = currentIndex >= 0 ? currentIndex + 1 : 0;
  const doneCount = Math.max(0, Math.min(scenes.length, currentIndex));
  const progressPercent = total > 0 ? Math.round((current / total) * 100) : 0;

  const displayWidth = collapsed ? 0 : sidebarWidth;
  // Preview width: sidebar minus list padding, the rail column and row padding.
  const previewSize = Math.max(100, sidebarWidth - 66);

  return (
    <div
      style={{
        width: displayWidth,
        transition: isDraggingRef.current ? 'none' : undefined,
      }}
      className="relative z-20 flex shrink-0 flex-col overflow-visible border-r border-border/70 bg-sidebar max-lg:max-w-[85vw] transition-[width] duration-200 motion-reduce:transition-none"
    >
      {/* Drag handle */}
      {!collapsed && (
        <div
          onMouseDown={handleDragStart}
          className="absolute right-0 top-0 bottom-0 hidden lg:block w-1.5 cursor-col-resize z-50 group hover:bg-primary/20 active:bg-primary/30 transition-colors"
        >
          <div className="absolute right-0.5 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-primary" />
        </div>
      )}

      <div className={cn('flex h-full w-full flex-col overflow-hidden', collapsed && 'hidden')}>
        {/* Heading: title, outline / preview toggle, collapse */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/70 pl-4 pr-2">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {t('platform.design.classroomContents')}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <div className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-card p-0.5">
              <button
                type="button"
                aria-label={t('platform.design.outlineView')}
                aria-pressed={!showThumbnails}
                onClick={() => setShowThumbnails(false)}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
                  !showThumbnails && 'bg-muted text-foreground',
                )}
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t('platform.design.thumbnailView')}
                aria-pressed={showThumbnails}
                onClick={() => setShowThumbnails(true)}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
                  showThumbnails && 'bg-muted text-foreground',
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>
            <button
              onClick={() => onCollapseChange(true)}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={t('platform.design.closeLearningPath')}
            >
              <PanelLeftClose className="size-4" />
            </button>
          </div>
        </div>

        {/* Progress summary */}
        <div className="shrink-0 px-4 pb-2 pt-3">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{t('classroomPath.progress', { current, total })}</span>
            <span className="tabular-nums">{t('classroomPath.doneCount', { count: doneCount })}</span>
          </div>
          <div
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={t('classroomPath.title')}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={current}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timeline */}
        <div
          data-testid="scene-list"
          role="navigation"
          aria-label={t('platform.design.classroomContents')}
          className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 pb-5 pt-1"
        >
          {scenes.map((scene, index) => {
            const meta = getSceneTypeMeta(scene.type);
            const Icon = meta.icon;
            const state = resolvePathStepState(index, currentIndex);
            const isActive = state === 'current';
            const isLast = index === scenes.length - 1 && !hasTrailingSlot;

            return (
              <div
                key={scene.id}
                data-testid="scene-item"
                data-scene-tone={meta.tone}
                data-step-state={state}
                role="button"
                tabIndex={0}
                aria-current={isActive ? 'step' : undefined}
                onKeyDown={(event) => activateOnKey(event, () => selectScene(scene.id))}
                onClick={() => selectScene(scene.id)}
                className={cn(STEP_ROW, 'cursor-pointer', isActive ? STEP_ROW_ACTIVE : STEP_ROW_IDLE)}
              >
                <StepRail
                  first={index === 0}
                  last={isLast}
                  nodeClassName={cn(
                    state === 'current' &&
                      'bg-(--scene-tone) text-(--classroom-tone-ink) shadow-[0_0_0_3px_var(--scene-tone-soft)]',
                    state === 'done' && 'bg-(--scene-tone-soft) text-(--scene-tone)',
                    state === 'upcoming' && 'bg-card text-muted-foreground ring-1 ring-border',
                  )}
                >
                  {state === 'done' ? (
                    <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                  ) : (
                    <Icon className="size-3.5" aria-hidden="true" />
                  )}
                </StepRail>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] leading-4">
                    <span className="font-medium text-(--scene-tone)">{t(meta.labelKey)}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {t('classroomPath.pageNumber', { number: index + 1 })}
                    </span>
                  </div>
                  <span
                    data-testid="scene-title"
                    className={cn(
                      'mt-0.5 line-clamp-2 text-sm leading-5 transition-colors',
                      isActive
                        ? 'font-semibold text-foreground'
                        : 'text-foreground/85 group-hover:text-foreground',
                    )}
                  >
                    {scene.title}
                  </span>

                  {showThumbnails && (
                    <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-lg bg-muted ring-1 ring-border/70">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ScenePreview
                          scene={scene}
                          meta={meta}
                          size={previewSize}
                          viewportSize={viewportSize}
                          viewportRatio={viewportRatio}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Next page being generated (clickable unless it failed) */}
          {hasGeneratingSlot &&
            (() => {
              const outline = generatingOutlines[0];
              const isFailed = failedOutlines.some((f) => f.id === outline.id);
              const isRetrying = retryingOutlineId === outline.id;
              const isPaused = generationStatus === 'paused';
              const isActive = isPendingActive && !isFailed;
              const open = () => {
                if (!isFailed) selectScene(PENDING_SCENE_ID);
              };

              return (
                <div
                  key={`generating-${outline.id}`}
                  role="button"
                  tabIndex={isFailed ? -1 : 0}
                  aria-current={isActive ? 'step' : undefined}
                  onKeyDown={(event) => activateOnKey(event, open)}
                  onClick={open}
                  className={cn(
                    STEP_ROW,
                    isFailed ? 'cursor-default' : 'cursor-pointer',
                    isActive ? STEP_ROW_ACTIVE : STEP_ROW_IDLE,
                  )}
                >
                  <StepRail
                    first={scenes.length === 0}
                    last
                    nodeClassName={cn(
                      isFailed
                        ? 'bg-destructive/10 text-destructive'
                        : isActive
                          ? 'bg-primary text-primary-foreground shadow-[0_0_0_3px_var(--accent)]'
                          : 'bg-accent text-primary',
                    )}
                  >
                    {isFailed ? (
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Loader2
                        className={cn('size-3.5', !isPaused && 'animate-spin')}
                        aria-hidden="true"
                      />
                    )}
                  </StepRail>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] leading-4">
                      <span
                        className={cn('font-medium', isFailed ? 'text-destructive' : 'text-primary')}
                      >
                        {isFailed
                          ? t('stage.generationFailed')
                          : isPaused
                            ? t('stage.paused')
                            : t('classroomPath.generatingStep')}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {t('classroomPath.pageNumber', { number: scenes.length + 1 })}
                      </span>
                    </div>
                    <span className="mt-0.5 line-clamp-2 text-sm leading-5 text-foreground/85">
                      {outline.title}
                    </span>
                    {isFailed ? (
                      onRetryOutline && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRetryOutline(outline.id);
                          }}
                          disabled={isRetrying}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                          title={t('generation.retryScene')}
                        >
                          <RefreshCw
                            className={cn('size-3.5', isRetrying && 'animate-spin')}
                            aria-hidden="true"
                          />
                          {isRetrying ? t('generation.retryingScene') : t('generation.retryScene')}
                        </button>
                      )
                    ) : (
                      <div className="mt-2 space-y-1.5" aria-hidden="true">
                        <div
                          className={cn('h-2 w-3/5 rounded bg-muted', !isPaused && 'animate-pulse')}
                        />
                        <div
                          className={cn('h-2 w-2/5 rounded bg-muted', !isPaused && 'animate-pulse')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* End of the path: the completion page */}
          {hasCompleteSlot && (
            <div
              role="button"
              tabIndex={0}
              aria-current={isPendingActive ? 'step' : undefined}
              onKeyDown={(event) => activateOnKey(event, () => selectScene(PENDING_SCENE_ID))}
              onClick={() => selectScene(PENDING_SCENE_ID)}
              className={cn(
                STEP_ROW,
                'cursor-pointer',
                isPendingActive ? STEP_ROW_ACTIVE : STEP_ROW_IDLE,
              )}
            >
              <StepRail
                first={scenes.length === 0}
                last
                nodeClassName={
                  isPendingActive
                    ? 'bg-primary text-primary-foreground shadow-[0_0_0_3px_var(--accent)]'
                    : 'bg-accent text-primary'
                }
              >
                <Trophy className="size-3.5" aria-hidden="true" />
              </StepRail>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium leading-4 text-primary">
                  {t('classroomPath.completeStep')}
                </div>
                <span
                  className={cn(
                    'mt-0.5 block text-sm leading-5',
                    isPendingActive ? 'font-semibold text-foreground' : 'text-foreground/85',
                  )}
                >
                  {t('stage.courseComplete')}
                </span>
                <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                  {t('classroomPath.completeHint')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Thumbnail for the optional preview view, tinted with the page's tone. */
function ScenePreview({
  scene,
  meta,
  size,
  viewportSize,
  viewportRatio,
}: {
  readonly scene: Scene;
  readonly meta: SceneTypeMeta;
  readonly size: number;
  readonly viewportSize: number;
  readonly viewportRatio: number;
}) {
  if (scene.type === 'slide') {
    return (
      <LazySlideThumbnail
        slide={(scene.content as SlideContent).canvas}
        sceneId={scene.id}
        viewportSize={viewportSize}
        viewportRatio={viewportRatio}
        size={size}
      />
    );
  }

  if (scene.type === 'interactive') {
    const content = scene.content as InteractiveContent;
    if (content?.html) return <ThumbnailInteractive content={content} size={size} />;
    /* Browser window with chrome + content */
    return (
      <div className="flex h-full w-full flex-col bg-(--scene-tone-soft) p-1.5">
        <div className="mb-1 flex items-center gap-1 border-b border-(--scene-tone)/20 pb-1">
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="size-1 rounded-full bg-(--scene-tone)/40" />
            ))}
          </div>
          <div className="ml-0.5 h-1.5 flex-1 rounded-full bg-(--scene-tone)/20" />
        </div>
        <div className="flex flex-1 gap-1">
          <div className="w-1/4 space-y-1 pt-0.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-0.5 w-full rounded-full bg-(--scene-tone)/30" />
            ))}
          </div>
          <div className="flex flex-1 items-center justify-center rounded border border-(--scene-tone)/20 bg-card/60">
            <Globe className="size-4 text-(--scene-tone)/60" />
          </div>
        </div>
      </div>
    );
  }

  if (scene.type === 'quiz') {
    /* Question bar + 2x2 option grid */
    return (
      <div className="flex h-full w-full flex-col bg-(--scene-tone-soft) p-2">
        <div className="mb-1.5 h-1.5 w-4/5 rounded-full bg-(--scene-tone)/35" />
        <div className="grid flex-1 grid-cols-2 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-1 rounded border px-1',
                i === 1
                  ? 'border-(--scene-tone)/50 bg-(--scene-tone)/15'
                  : 'border-(--scene-tone)/15 bg-card/70',
              )}
            >
              <div
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  i === 1 ? 'bg-(--scene-tone)' : 'bg-(--scene-tone)/30',
                )}
              />
              <div
                className={cn(
                  'h-1 flex-1 rounded-full',
                  i === 1 ? 'bg-(--scene-tone)/50' : 'bg-(--scene-tone)/20',
                )}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (scene.type === 'pbl') {
    /* Task board with three columns */
    return (
      <div className="flex h-full w-full flex-col bg-(--scene-tone-soft) p-1.5">
        <div className="mb-1.5 flex items-center gap-1">
          <div className="size-1.5 rounded bg-(--scene-tone)/60" />
          <div className="h-1 w-8 rounded-full bg-(--scene-tone)/30" />
        </div>
        <div className="flex flex-1 gap-1 overflow-hidden">
          {[3, 2, 1].map((cards, col) => (
            <div key={col} className="flex flex-1 flex-col gap-0.5 rounded bg-card/70 p-0.5">
              <div className="mb-0.5 h-0.5 w-3 rounded-full bg-(--scene-tone)/50" />
              {Array.from({ length: cards }).map((_, i) => (
                <div
                  key={i}
                  className="h-2 w-full rounded border border-(--scene-tone)/20 bg-(--scene-tone)/15"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const Icon = meta.icon;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-(--scene-tone-soft) text-(--scene-tone)">
      <Icon className="size-4" />
    </div>
  );
}

/**
 * Viewport-gated slide thumbnail for the playback sidebar. Scenes far outside
 * the viewport render SlideThumbnail's cheap placeholder instead of a full
 * SlideCanvas — which also spares every off-screen video element its
 * `preload="metadata"` fetch when the classroom opens. The placeholder keeps
 * the same box size, so gating never shifts layout.
 */
function LazySlideThumbnail({
  slide,
  sceneId,
  viewportSize,
  viewportRatio,
  size,
}: {
  readonly slide: SlideContent['canvas'];
  readonly sceneId: string;
  readonly viewportSize: number;
  readonly viewportRatio: number;
  readonly size: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useNearViewport(ref);
  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      <SlideThumbnail
        slide={slide}
        sceneId={sceneId}
        viewportSize={viewportSize}
        viewportRatio={viewportRatio}
        size={size}
        visible={visible}
      />
    </div>
  );
}
