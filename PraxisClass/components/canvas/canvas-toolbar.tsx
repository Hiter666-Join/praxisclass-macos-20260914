'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  PencilLine,
  LayoutList,
  MessageSquare,
  Volume1,
  Volume2,
  VolumeX,
  Repeat,
  Maximize2,
  Minimize2,
  Quote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSoftCloseCountdown } from '@/components/chat/use-soft-close-countdown';

export interface CanvasToolbarProps {
  readonly currentSceneIndex: number;
  readonly scenesCount: number;
  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly isLiveSession?: boolean;
  readonly isSoftClosing?: boolean;
  readonly softCloseDeadline?: number;
  readonly whiteboardOpen: boolean;
  readonly sidebarCollapsed?: boolean;
  readonly chatCollapsed?: boolean;
  readonly onToggleSidebar?: () => void;
  readonly onToggleChat?: () => void;
  readonly onPrevSlide: () => void;
  readonly onNextSlide: () => void;
  readonly onPlayPause: () => void;
  readonly onWhiteboardClose: () => void;
  readonly showStopDiscussion?: boolean;
  readonly onStopDiscussion?: () => void;
  readonly onContinueDiscussion?: () => void;
  readonly isPresenting?: boolean;
  readonly onTogglePresentation?: () => void;
  readonly className?: string;
  // Audio/playback controls
  readonly ttsEnabled?: boolean;
  readonly ttsMuted?: boolean;
  readonly ttsVolume?: number;
  readonly onToggleMute?: () => void;
  readonly onVolumeChange?: (volume: number) => void;
  readonly autoPlayLecture?: boolean;
  readonly onToggleAutoPlay?: () => void;
  readonly playbackSpeed?: number;
  readonly onCycleSpeed?: () => void;
  readonly showElementReference?: boolean;
  readonly canPickSlideElement?: boolean;
  readonly elementPickActive?: boolean;
  readonly onToggleElementPick?: () => void;
}

/* Shared touch and keyboard target for classroom controls. */
const ctrlBtn = cn(
  'relative size-9 shrink-0 rounded-lg flex items-center justify-center',
  'transition-colors duration-150 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-ring',
  'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40',
);

/* Subtle separator */
function CtrlDivider() {
  return <div className="mx-0.5 h-3 w-px shrink-0 bg-border" />;
}

/* Volume icon based on level */
function VolumeIcon({
  muted,
  volume,
  disabled,
}: {
  muted: boolean;
  volume: number;
  disabled: boolean;
}) {
  const cls = 'w-3.5 h-3.5';
  if (disabled || muted || volume === 0) return <VolumeX className={cls} />;
  if (volume < 0.5) return <Volume1 className={cls} />;
  return <Volume2 className={cls} />;
}

export function CanvasToolbar({
  currentSceneIndex,
  scenesCount,
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
  showStopDiscussion,
  onStopDiscussion,
  onContinueDiscussion,
  isPresenting,
  onTogglePresentation,
  className,
  ttsEnabled,
  ttsMuted,
  ttsVolume = 1,
  onToggleMute,
  onVolumeChange,
  autoPlayLecture,
  onToggleAutoPlay,
  playbackSpeed = 1,
  onCycleSpeed,
  showElementReference,
  canPickSlideElement,
  elementPickActive,
  onToggleElementPick,
}: CanvasToolbarProps) {
  const { t } = useI18n();
  const remainingSoftCloseSeconds = useSoftCloseCountdown(softCloseDeadline);
  const canGoPrev = currentSceneIndex > 0;
  const canGoNext = currentSceneIndex < scenesCount - 1;
  const showPlayPause = !isLiveSession;

  const whiteboardElementCount = useStageStore(
    (s) => s.stage?.whiteboard?.[0]?.elements?.length || 0,
  );

  // Volume slider hover state
  const [volumeHover, setVolumeHover] = useState(false);
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  const handleVolumeEnter = useCallback(() => {
    clearTimeout(volumeTimerRef.current);
    setVolumeHover(true);
  }, []);

  const handleVolumeLeave = useCallback(() => {
    volumeTimerRef.current = setTimeout(() => setVolumeHover(false), 300);
  }, []);

  // Cleanup volume hover timer on unmount
  useEffect(() => () => clearTimeout(volumeTimerRef.current), []);

  // Effective volume for display
  const effectiveVolume = ttsMuted ? 0 : ttsVolume;
  const presentationLabel = isPresenting ? t('stage.exitFullscreen') : t('stage.fullscreen');

  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 py-1 sm:flex-nowrap', className)}
    >
      {/* ── Left: sidebar toggle + page indicator ── */}
      <div className="flex items-center gap-1 shrink-0 pl-1">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={cn(
              ctrlBtn,
              sidebarCollapsed
                ? 'text-muted-foreground'
                : 'text-foreground',
            )}
            aria-label={t('platform.design.classroomContents')}
            aria-expanded={!sidebarCollapsed}
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
        )}
        <span className="text-xs text-muted-foreground tabular-nums select-none font-medium">
          {currentSceneIndex + 1}
          <span className="opacity-35 mx-px">/</span>
          {scenesCount}
        </span>
      </div>

      <div className="hidden sm:block">
        <CtrlDivider />
      </div>

      {/* ── Center: unified playback controls ── */}
      <div className="order-3 flex basis-full items-center justify-center min-w-0 sm:order-none sm:flex-1 sm:basis-auto">
        <div
          className={cn(
            'inline-flex flex-wrap items-center justify-center gap-0.5 px-1 min-h-9',
            isPresenting
              ? '' /* Single visual layer in fullscreen — buttons sit inside outer pill directly */
              : 'bg-muted/70 rounded-xl',
          )}
        >
          {/* Volume with vertical popover slider */}
          {onToggleMute && (
            <div
              ref={volumeContainerRef}
              className="relative flex items-center"
              onMouseEnter={handleVolumeEnter}
              onMouseLeave={handleVolumeLeave}
              onFocus={handleVolumeEnter}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) handleVolumeLeave();
              }}
            >
              <button
                onClick={onToggleMute}
                disabled={!ttsEnabled}
                className={cn(
                  ctrlBtn,
                  !ttsEnabled
                    ? 'cursor-not-allowed text-muted-foreground/50'
                    : ttsMuted
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                )}
                aria-label={t(ttsMuted ? 'platform.design.unmute' : 'platform.design.mute')}
              >
                <VolumeIcon muted={!!ttsMuted} volume={ttsVolume} disabled={!ttsEnabled} />
              </button>

              {/* Vertical volume slider (pops up above) */}
              <div
                className={cn(
                  'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col items-center',
                  'transition-all duration-200 ease-out pointer-events-none opacity-0',
                  volumeHover && ttsEnabled && 'pointer-events-auto opacity-100',
                )}
              >
                <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-popover px-2 py-2.5 shadow-lg">
                  <span className="select-none text-[10px] font-medium tabular-nums text-muted-foreground">
                    {Math.round(effectiveVolume * 100)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    aria-label={t('platform.design.volume')}
                    disabled={!ttsEnabled}
                    tabIndex={ttsEnabled ? 0 : -1}
                    value={effectiveVolume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onVolumeChange?.(v);
                      if (v > 0 && ttsMuted) onToggleMute?.();
                    }}
                    className={cn(
                      'appearance-none cursor-pointer',
                      'h-16 w-1 rounded-full',
                      'bg-muted',
                      '[writing-mode:vertical-lr] [direction:rtl]',
                      '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
                      '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
                      '[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer',
                      '[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3',
                      '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0',
                    )}
                  />
                </div>
                {/* Arrow pointing down */}
                <div className="-mt-[5px] h-2 w-2 rotate-45 border-b border-r border-border bg-popover" />
              </div>
            </div>
          )}

          {/* Speed */}
          {onCycleSpeed && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onCycleSpeed}
                    className={cn(
                      ctrlBtn,
                      'text-xs font-semibold tabular-nums leading-none',
                      playbackSpeed !== 1
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    aria-label={t('roundtable.speed')}
                  >
                    {playbackSpeed === 1.5 ? '1.5x' : `${playbackSpeed}x`}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t('roundtable.speed')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <CtrlDivider />

          {/* Prev scene */}
          {scenesCount > 1 && (
            <button
              onClick={onPrevSlide}
              disabled={!canGoPrev}
              className={cn(ctrlBtn, 'text-muted-foreground disabled:pointer-events-none')}
              aria-label={t('platform.design.previousPage')}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Play / Pause / Stop Discussion */}
          {showStopDiscussion && onStopDiscussion ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStopDiscussion();
                }}
                className={cn(
                  'flex items-center gap-1.5 min-h-9 px-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring',
                  'bg-destructive/10 text-destructive',
                  'text-[11px] font-semibold whitespace-nowrap',
                  'hover:bg-destructive/20 active:scale-95 transition-all cursor-pointer',
                )}
                title={t('roundtable.stopDiscussion')}
              >
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
                {t('roundtable.stopDiscussion')}
              </button>
              {isSoftClosing && onContinueDiscussion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onContinueDiscussion();
                  }}
                  className="flex items-center gap-1.5 min-h-9 px-2.5 rounded-lg border border-border bg-background text-primary text-xs font-medium whitespace-nowrap hover:bg-accent transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
                  title={t('roundtable.softClosing')}
                >
                  {t('roundtable.softClosing')}
                  {remainingSoftCloseSeconds !== undefined && (
                    <span className="text-[9px] font-medium tabular-nums text-muted-foreground">
                      {remainingSoftCloseSeconds}s
                    </span>
                  )}
                </button>
              )}
            </div>
          ) : showPlayPause ? (
            <button
              onClick={onPlayPause}
              className={cn(
                ctrlBtn,
                'mx-0.5 rounded-full shadow-sm',
                engineState === 'playing'
                  ? 'bg-primary/15 text-primary hover:bg-primary/25'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
              aria-label={t(
                engineState === 'playing' ? 'proactiveCard.pause' : 'platform.design.playLesson',
              )}
            >
              {engineState === 'playing' ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 ml-px" />
              )}
            </button>
          ) : null}

          {/* Next scene */}
          {scenesCount > 1 && (
            <button
              onClick={onNextSlide}
              disabled={!canGoNext}
              className={cn(ctrlBtn, 'text-muted-foreground disabled:pointer-events-none')}
              aria-label={t('platform.design.nextPage')}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          <CtrlDivider />

          {/* Auto-play */}
          {onToggleAutoPlay && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleAutoPlay}
                    className={cn(
                      ctrlBtn,
                      autoPlayLecture
                        ? 'text-primary'
                        : 'text-muted-foreground',
                    )}
                    aria-label={t('roundtable.autoPlay')}
                    aria-pressed={!!autoPlayLecture}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {autoPlayLecture ? t('roundtable.autoPlayOff') : t('roundtable.autoPlay')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Whiteboard */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWhiteboardClose();
            }}
            className={cn(
              ctrlBtn,
              whiteboardOpen
                ? 'text-primary'
                : 'text-muted-foreground',
            )}
            title={whiteboardOpen ? t('whiteboard.minimize') : t('whiteboard.open')}
            aria-label={whiteboardOpen ? t('whiteboard.minimize') : t('whiteboard.open')}
            aria-pressed={whiteboardOpen}
          >
            <PencilLine className="w-3.5 h-3.5" />
            {!whiteboardOpen && whiteboardElementCount > 0 && (
              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>

          {showElementReference && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleElementPick?.();
              }}
              disabled={!canPickSlideElement}
              className={cn(
                'relative flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                elementPickActive
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                  : 'text-muted-foreground hover:bg-muted',
                !canPickSlideElement && 'cursor-not-allowed opacity-35',
              )}
              aria-label={t('chat.elementReference.button')}
              aria-pressed={elementPickActive}
              title={
                canPickSlideElement
                  ? t('chat.elementReference.button')
                  : t('chat.elementReference.unavailable')
              }
            >
              <Quote className="h-3.5 w-3.5" />
              <span>{t('chat.elementReference.button')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Right: fullscreen + chat toggle ── */}
      <div className="ml-auto flex items-center justify-end gap-1 shrink-0 pr-1 sm:ml-0">
        <CtrlDivider />
        {onTogglePresentation && (
          <button
            onClick={onTogglePresentation}
            className={cn(
              ctrlBtn,
              isPresenting
                ? 'text-primary'
                : 'text-muted-foreground',
            )}
            aria-label={presentationLabel}
            title={presentationLabel}
          >
            {isPresenting ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {onToggleChat && (
          <button
            onClick={onToggleChat}
            className={cn(
              ctrlBtn,
              chatCollapsed
                ? 'text-muted-foreground'
                : 'text-foreground',
            )}
            aria-label={t('platform.design.classroomNotes')}
            aria-expanded={!chatCollapsed}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
