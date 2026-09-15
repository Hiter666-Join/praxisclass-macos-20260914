'use client';

import { useEffect, useRef } from 'react';
import {
  BookOpen,
  MessageSquare,
  Flashlight,
  MousePointer2,
  Play,
  Highlighter,
  SlidersHorizontal,
  StickyNote,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { LectureNoteEntry } from '@/lib/types/chat';
import { getSceneTypeMeta } from '@/lib/classroom/scene-type-meta';

const ACTION_ICON_ONLY: Record<string, { Icon: typeof Flashlight; style: string }> = {
  spotlight: {
    Icon: Flashlight,
    style:
      'bg-yellow-50 dark:bg-yellow-500/15 border-yellow-300/40 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
  },
  laser: {
    Icon: MousePointer2,
    style:
      'bg-red-50 dark:bg-red-500/15 border-red-300/40 dark:border-red-500/30 text-red-600 dark:text-red-300',
  },
  play_video: {
    Icon: Play,
    style:
      'bg-yellow-50 dark:bg-yellow-500/15 border-yellow-300/40 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
  },
  widget_highlight: {
    Icon: Highlighter,
    style:
      'bg-amber-50 dark:bg-amber-500/15 border-amber-300/40 dark:border-amber-500/30 text-amber-700 dark:text-amber-300',
  },
  widget_setState: {
    Icon: SlidersHorizontal,
    style: 'bg-accent border-primary/30 text-primary',
  },
  widget_annotation: {
    Icon: StickyNote,
    style:
      'bg-sky-50 dark:bg-sky-500/15 border-sky-300/40 dark:border-sky-500/30 text-sky-700 dark:text-sky-300',
  },
  widget_reveal: {
    Icon: Eye,
    style:
      'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300/40 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
  },
};

/**
 * Render rows for one page: inline actions (spotlight/laser) are attached to
 * the next speech line, discussions render as their own block, trailing
 * actions without a following speech line become a bare icon row.
 */
type NoteRow =
  | {
      kind: 'speech';
      inlineActions: string[];
      text: string;
      actionIndex: number;
      actionId: string;
    }
  | { kind: 'discussion'; label?: string; actionIndex: number; actionId: string }
  | { kind: 'trailing'; inlineActions: string[] };

function buildNoteRows(note: LectureNoteEntry): NoteRow[] {
  const rows: NoteRow[] = [];
  let pendingInline: string[] = [];
  for (const item of note.items) {
    if (item.kind === 'action' && item.type === 'discussion') {
      if (pendingInline.length > 0) {
        rows.push({ kind: 'trailing', inlineActions: pendingInline });
        pendingInline = [];
      }
      rows.push({
        kind: 'discussion',
        label: item.label,
        actionIndex: item.actionIndex,
        actionId: item.actionId,
      });
    } else if (item.kind === 'action') {
      pendingInline.push(item.type);
    } else {
      rows.push({
        kind: 'speech',
        inlineActions: pendingInline,
        text: item.text,
        actionIndex: item.actionIndex,
        actionId: item.actionId,
      });
      pendingInline = [];
    }
  }
  if (pendingInline.length > 0) {
    rows.push({ kind: 'trailing', inlineActions: pendingInline });
  }
  return rows;
}

function InlineActionIcons({ actions }: { readonly actions: readonly string[] }) {
  return (
    <>
      {actions.map((action, index) => {
        const cfg = ACTION_ICON_ONLY[action];
        if (!cfg) return null;
        const { Icon, style } = cfg;
        return (
          <span
            key={`${action}-${index}`}
            className={cn(
              'inline-flex items-center justify-center w-4 h-4 rounded-full border align-middle mr-0.5',
              style,
            )}
          >
            <Icon className="w-2.5 h-2.5" />
          </span>
        );
      })}
    </>
  );
}

interface LectureNotesViewProps {
  notes: LectureNoteEntry[];
  /** scene.id → scene.type, used to colour the page markers by page type. */
  sceneTypes?: Record<string, string | undefined>;
  currentSceneId?: string | null;
  currentActionIndex?: number | null;
  canJumpToAction?: (sceneId: string, actionIndex: number) => boolean;
  onJumpToAction?: (sceneId: string, actionIndex: number) => void;
}

/**
 * Lecture transcript as a page-marked timeline: one node per page (coloured by
 * page type, mirrors the learning-path sidebar), each holding the teacher's
 * lines for that page. Lines on the current page can jump playback.
 */
export function LectureNotesView({
  notes,
  sceneTypes,
  currentSceneId,
  currentActionIndex,
  canJumpToAction,
  onJumpToAction,
}: LectureNotesViewProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const currentIndex = notes.findIndex((note) => note.sceneId === currentSceneId);

  // Auto-scroll to the current scene note
  useEffect(() => {
    if (!currentSceneId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-scene-id="${currentSceneId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSceneId]);

  // Empty state
  if (notes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 text-primary">
          <BookOpen className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-foreground">{t('chat.lectureNotes.empty')}</p>
        <p className="text-sm leading-6 text-muted-foreground mt-2">
          {t('chat.lectureNotes.emptyHint')}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-classroom-record
      className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 scrollbar-hide"
    >
      <ol className="flex flex-col">
        {notes.map((note, index) => {
          const isCurrent = note.sceneId === currentSceneId;
          const isDone = currentIndex >= 0 && index < currentIndex;
          const isLast = index === notes.length - 1;
          const meta = getSceneTypeMeta(sceneTypes?.[note.sceneId]);
          const TypeIcon = meta.icon;
          const pageLabel = t('chat.lectureNotes.pageLabel', { n: index + 1 });
          const rows = buildNoteRows(note);
          const lineCount = rows.filter((row) => row.kind === 'speech').length;

          return (
            <li
              key={note.sceneId}
              data-scene-id={note.sceneId}
              data-scene-tone={meta.tone}
              data-step-state={isCurrent ? 'current' : isDone ? 'done' : 'upcoming'}
              className={cn('relative flex gap-2.5', !isLast && 'pb-4')}
            >
              {/* Timeline rail: type node + connector */}
              <div className="relative flex w-6 shrink-0 justify-center">
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-6 -bottom-4 w-px -translate-x-1/2 bg-border"
                  />
                )}
                <span
                  className={cn(
                    'relative z-[1] flex size-6 items-center justify-center rounded-full transition-colors',
                    isCurrent
                      ? 'bg-(--scene-tone) text-(--classroom-tone-ink) shadow-[0_0_0_3px_var(--scene-tone-soft)]'
                      : isDone
                        ? 'bg-(--scene-tone-soft) text-(--scene-tone)'
                        : 'bg-card text-muted-foreground ring-1 ring-border',
                  )}
                >
                  <TypeIcon className="size-3.5" />
                </span>
              </div>

              {/* Page card */}
              <div
                className={cn(
                  'min-w-0 flex-1 rounded-xl px-2.5 py-2 transition-colors duration-200',
                  isCurrent ? 'bg-card shadow-sm ring-1 ring-border/70' : 'bg-transparent',
                )}
              >
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span
                    className={cn(
                      'text-[10px] font-semibold',
                      isCurrent ? 'text-(--scene-tone)' : 'text-muted-foreground',
                    )}
                  >
                    {t(meta.labelKey)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">·</span>
                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                    {pageLabel}
                  </span>
                  {isCurrent && (
                    <span className="rounded-full bg-(--scene-tone) px-1.5 py-px text-[9px] font-semibold text-(--classroom-tone-ink)">
                      {t('chat.lectureNotes.currentPage')}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/80">
                    {t('classroomRecord.lineCount', { count: lineCount })}
                  </span>
                </div>

                <h4
                  className={cn(
                    'mt-0.5 text-[13px] font-semibold leading-snug',
                    isCurrent ? 'text-foreground' : 'text-foreground/80',
                  )}
                >
                  {note.sceneTitle}
                </h4>

                <div className="mt-1.5 space-y-0.5">
                  {rows.map((row, rowIndex) => {
                    if (row.kind === 'discussion') {
                      return (
                        <div
                          key={row.actionId}
                          className="my-1.5 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5"
                        >
                          <MessageSquare className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <span className="text-[11px] leading-snug text-amber-800 dark:text-amber-300">
                            {row.label}
                          </span>
                        </div>
                      );
                    }

                    if (row.kind === 'trailing') {
                      return (
                        <p
                          key={`trailing-${rowIndex}`}
                          className="pl-2 text-[12px] leading-[1.8] text-muted-foreground"
                        >
                          <InlineActionIcons actions={row.inlineActions} />
                        </p>
                      );
                    }

                    const isActiveSpeech = isCurrent && row.actionIndex === currentActionIndex;
                    const canJump =
                      isCurrent &&
                      !!onJumpToAction &&
                      (canJumpToAction?.(note.sceneId, row.actionIndex) ?? false);
                    const jumpTitle = canJump
                      ? t('chat.lectureNotes.jumpToLine')
                      : t('chat.lectureNotes.jumpUnavailable');

                    return (
                      <button
                        key={row.actionId}
                        type="button"
                        disabled={!canJump}
                        title={jumpTitle}
                        onClick={() => onJumpToAction?.(note.sceneId, row.actionIndex)}
                        className={cn(
                          'block w-full rounded-r-md border-l-2 pl-2 pr-1 py-0.5 text-left text-[12px] leading-[1.8] transition-colors',
                          isActiveSpeech
                            ? 'border-(--scene-tone) bg-(--scene-tone-soft) text-foreground'
                            : isCurrent
                              ? 'border-transparent text-foreground/90'
                              : 'border-transparent text-muted-foreground',
                          canJump ? 'cursor-pointer hover:bg-muted' : 'cursor-default',
                        )}
                        aria-label={jumpTitle}
                        aria-current={isActiveSpeech ? 'true' : undefined}
                      >
                        <InlineActionIcons actions={row.inlineActions} />
                        {row.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
