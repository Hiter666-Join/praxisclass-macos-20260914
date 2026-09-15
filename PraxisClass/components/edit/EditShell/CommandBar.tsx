'use client';

import { ArrowLeft, Redo2, Undo2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { cn } from '@/lib/utils';
import type { EditorCommand, SurfaceHistory } from '@/lib/edit/scene-editor-surface';
import { classroomExitLabelKey, exitClassroom } from '@/lib/workbench/classroom-exit';
import { saveBeforeLeaving } from '@/lib/edit/classroom-save';

interface CommandBarProps {
  readonly title: string;
  readonly history?: SurfaceHistory;
  readonly commands?: readonly EditorCommand[];
  /**
   * Right-edge slot owned by Stage. In Pro mode it carries the
   * HeaderControls (settings pill + Pro Switch + Download) since Stage
   * Header is unmounted to keep top chrome to a single bar.
   */
  readonly trailing?: ReactNode;
}

/**
 * Top bar of the Pro mode chrome. Undo/redo + title on the left, insert
 * primitives in the center, surface commands on the right. History /
 * insertItems / commands are all optional so the bar renders cleanly when
 * no surface is registered for the current scene type.
 *
 * The trailing slot exposes explicit save and exit controls for every surface.
 */
export function CommandBar({ title, history, commands, trailing }: CommandBarProps) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const platformMode = useSettingsStore((state) => state.mode);
  const exitLabel = t(classroomExitLabelKey(searchParams, platformMode));

  return (
    <header className="flex min-h-20 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6 lg:flex-nowrap">
      <div className="flex min-w-0 basis-full items-center gap-2 lg:flex-1 lg:basis-auto">
        {/* Classroom exit mirrors playback Header's leftmost button so the
            user has the same global-out affordance across standalone modes. */}
        <IconButton
          title={exitLabel}
          aria-label={exitLabel}
          onClick={() => void saveBeforeLeaving(() => exitClassroom(router, searchParams, platformMode))}
        >
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        {history && (
          <>
            <IconButton title={t('edit.undo')} disabled={!history.canUndo} onClick={history.undo}>
              <Undo2 className="h-4 w-4" />
            </IconButton>
            <IconButton title={t('edit.redo')} disabled={!history.canRedo} onClick={history.redo}>
              <Redo2 className="h-4 w-4" />
            </IconButton>
          </>
        )}
        <span
          className={cn('ml-2 truncate text-sm font-semibold text-zinc-700 dark:text-zinc-200')}
          title={title}
        >
          {title}
        </span>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {commands && commands.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            {commands.map((command) => (
              <IconButton
                key={command.id}
                title={command.tooltip ?? command.label}
                disabled={command.disabled}
                onClick={command.onInvoke}
              >
                {command.icon ?? <span className="px-1 text-xs">{command.label}</span>}
              </IconButton>
            ))}
          </div>
        )}
        {trailing}
      </div>
    </header>
  );
}

function IconButton({
  title,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { readonly title: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          className="size-9 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={title}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
