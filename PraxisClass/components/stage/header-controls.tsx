'use client';

import { useState } from 'react';
import {
  Archive,
  Download,
  FileDown,
  Film,
  Loader2,
  Monitor,
  Moon,
  NotebookText,
  Package,
  PencilLine,
  Settings,
  Sun,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useTheme } from '@/lib/hooks/use-theme';
import { useStageStore } from '@/lib/store';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useExportPPTX } from '@/lib/export/use-export-pptx';
import { useExportClassroom } from '@/lib/export/use-export-classroom';
import { isScriptExportReady, useExportScript } from '@/lib/export/use-export-script';
import { isVideoExportEnabled } from '@/lib/config/feature-flags';
import { useVideoRenderStore } from '@/lib/store/video-render';
import { CircularProgress } from '@/components/ui/circular-progress';
import { VideoExportDialog } from './video-export-dialog';
import { LanguageSwitcher } from '../language-switcher';
import { SettingsDialog } from '../settings';
import { ReminderBell } from '../platform/reminder-bell';
import { useSettingsStore } from '@/lib/store/settings';
import { BackToPlatformLink } from '../platform/back-to-platform-link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { StageMode } from '@/lib/types/stage';

interface HeaderControlsProps {
  readonly mode?: StageMode;
  readonly proModeActive?: boolean;
  readonly canEdit?: boolean;
  readonly onToggleEditMode?: () => void;
  readonly showGlobalControls?: boolean;
  readonly showCourseActions?: boolean;
  /**
   * `default` — full-height controls in the playback header.
   * `compact` — tighter padding for the editor command bar.
   */
  readonly variant?: 'default' | 'compact';
}

/**
 * Stage-level global controls: language picker, theme picker, settings
 * modal trigger, and the Pro Switch. Extracted out of `Header` so the
 * Pro mode CommandBar can absorb the same affordances and the playback
 * Header doesn't need to stay mounted just to host them — Pro mode
 * therefore lands on a single top-chrome bar instead of stacking the
 * Stage Header above the EditShell CommandBar.
 *
 * Only one instance is ever mounted at a time (Stage renders Header
 * for playback and EditShell.CommandBar's trailing slot for edit, but
 * never both), so dropdown / dialog state and refs stay co-located
 * here without cross-instance leakage.
 */
export function HeaderControls({
  mode,
  proModeActive,
  canEdit,
  onToggleEditMode,
  showGlobalControls = true,
  showCourseActions = true,
  variant = 'default',
}: HeaderControlsProps) {
  const { t } = useI18n();
  const teacherMode = useSettingsStore(s => s.mode === 'teacher');
  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);

  // Export plumbing — uses the stage / media task stores to check
  // readiness, then hands off to the export hooks. Available in both
  // playback and edit chrome so the icon's screen position is stable
  // across mode swaps (was previously in `Header` only, missing from
  // CommandBar's right cluster).
  const scenes = useStageStore((s) => s.scenes);
  const generatingOutlines = useStageStore((s) => s.generatingOutlines);
  const failedOutlines = useStageStore((s) => s.failedOutlines);
  const mediaTasks = useMediaGenerationStore((s) => s.tasks);
  const { exporting: isExporting, exportPPTX, exportResourcePack } = useExportPPTX();
  const { exporting: isExportingZip, exportClassroomZip } = useExportClassroom();
  const { exporting: isExportingScript, exportScriptDocx, exportScriptMd } = useExportScript();
  const videoExportEnabled = isVideoExportEnabled();
  // Video render lives in a global store so its progress ring stays on the
  // export button even after the menu closes / scenes switch mid-render.
  const videoRendering = useVideoRenderStore(
    (s) => s.status === 'compiling' || s.status === 'rendering',
  );
  const videoRenderPercent = useVideoRenderStore((s) => s.percent);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Keep the original full-generation gate for the export menu. Script files
  // are text-only, but the latest review confirmed that this menu intentionally
  // stays unavailable until all media tasks have completed or failed.
  const canExport = isScriptExportReady({ scenes, generatingOutlines, failedOutlines }, mediaTasks);
  const exportLabel = canExport ? t('platform.design.exportCourse') : t('share.notReady');

  const compact = variant === 'compact';
  const proChecked = proModeActive ?? mode === 'edit';

  if (!showGlobalControls && !showCourseActions) {
    return onToggleEditMode ? (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t('classroomPath.editToggle')}
        </span>
        <Switch
          checked={proChecked}
          onCheckedChange={onToggleEditMode}
          disabled={!canEdit}
          aria-label={proChecked ? t('stage.doneEditing') : t('stage.editCourse')}
        />
      </div>
    ) : null;
  }

  // Self-contained spacing so the control cluster is identical regardless of
  // host. The playback Header (`gap-4`) and the edit CommandBar's trailing
  // slot (`gap-2`) would otherwise impose different inter-control spacing on
  // these fragment children, making the pill/switch/export cluster visibly
  // shift width and position across the mode swap. A fixed internal gap keeps
  // the cluster pixel-stable; both hosts pad to `px-8`, so the right edge
  // anchors identically too.
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {showGlobalControls && <ReminderBell enabled={teacherMode} />}
      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 rounded-xl border border-border/70 bg-card',
          compact ? 'px-1 py-0.5' : 'p-1',
        )}
      >
        {/* Language — Radix DropdownMenu so its menu portals to body
            and never gets clipped by an ancestor's overflow-hidden. */}
        <LanguageSwitcher />

        {/* Theme — same Portal-backed DropdownMenu pattern. Non-modal keeps
            Radix from body scroll-locking a fixed-height classroom layout. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={t('settings.theme')}
            >
              {theme === 'light' && <Sun className="w-4 h-4" />}
              {theme === 'dark' && <Moon className="w-4 h-4" />}
              {theme === 'system' && <Monitor className="w-4 h-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="min-w-[140px]">
            <DropdownMenuItem
              onSelect={() => setTheme('light')}
              className={cn(
                'cursor-pointer gap-2',
                theme === 'light' &&
                  'bg-accent text-accent-foreground',
              )}
            >
              <Sun className="w-4 h-4" />
              {t('settings.themeOptions.light')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setTheme('dark')}
              className={cn(
                'cursor-pointer gap-2',
                theme === 'dark' &&
                  'bg-accent text-accent-foreground',
              )}
            >
              <Moon className="w-4 h-4" />
              {t('settings.themeOptions.dark')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setTheme('system')}
              className={cn(
                'cursor-pointer gap-2',
                theme === 'system' &&
                  'bg-accent text-accent-foreground',
              )}
            >
              <Monitor className="w-4 h-4" />
              {t('settings.themeOptions.system')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden sm:block">
          <BackToPlatformLink />
        </div>

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={t('settings.title')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Pro Switch — toggle property: on/off both clickable, not a
          one-way "Done" button. Disabled only when the current scene
          can't be entered (pending/generating/etc.). Fades in with its
          host bar on the mode swap (no cross-bar layoutId morph: the
          playback Header and edit CommandBar have different left-side
          widths, so morphing made the pill visibly drift). */}
      {onToggleEditMode && (
        <label
          className={cn(
            'inline-flex shrink-0 items-center gap-2.5 rounded-xl border bg-card transition-colors duration-200',
            compact ? 'h-9 px-2.5' : 'h-11 px-3',
            proChecked ? 'border-primary/60' : 'border-border/70',
            !canEdit && mode !== 'edit'
              ? 'opacity-60 cursor-not-allowed'
              : 'cursor-pointer hover:border-primary/50',
          )}
          // When disabled (e.g. the course-complete placeholder), explain why
          // on hover and point the user to a real scene instead of a bare
          // "Edit course" label they can't act on.
          title={
            !canEdit && mode !== 'edit'
              ? t('stage.proModeDisabledHint')
              : proChecked
                ? t('stage.doneEditing')
                : t('stage.editCourse')
          }
        >
          <span
            className={cn(
              'flex select-none items-center gap-1.5 text-sm font-medium transition-colors duration-200',
              proChecked ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <PencilLine className="size-4" aria-hidden="true" />
            {t('classroomPath.editToggle')}
          </span>
          <Switch
            checked={proChecked}
            onCheckedChange={onToggleEditMode}
            disabled={!canEdit && mode !== 'edit'}
            aria-label={proChecked ? t('stage.doneEditing') : t('stage.editCourse')}
          />
        </label>
      )}

      {/* Export / Download — lives to the right of the Pro Switch.
          Not a settings function so it does not belong inside the
          settings pill; kept as a separate sibling sitting between the
          Pro Switch and the right edge of the chrome. */}
      <DropdownMenu modal={false} open={exportMenuOpen} onOpenChange={setExportMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            disabled={!canExport || isExporting || isExportingZip || isExportingScript}
            title={
              isExporting || isExportingZip || isExportingScript
                ? t('export.exporting')
                : exportLabel
            }
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-ring',
              canExport && !isExporting && !isExportingZip && !isExportingScript
                ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                : 'cursor-not-allowed text-muted-foreground/50',
            )}
            aria-label={exportLabel}
          >
            {isExporting || isExportingZip || isExportingScript ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : videoRendering ? (
              // Persistent ring: video render runs in the background; keep it
              // visible on the button whether or not the menu is open.
              <CircularProgress value={videoRenderPercent} size={20} className="text-primary" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-[240px]">
          <DropdownMenuItem
            disabled={!canExport}
            onSelect={exportPPTX}
            className="cursor-pointer gap-2.5"
            title={canExport ? undefined : t('export.mediaPending')}
          >
            <FileDown className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>{t('export.pptx')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canExport}
            onSelect={exportResourcePack}
            className="cursor-pointer gap-2.5"
            title={canExport ? undefined : t('export.mediaPending')}
          >
            <Package className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <div>{t('export.resourcePack')}</div>
              <div className="text-[11px] text-muted-foreground">
                {t('export.resourcePackDesc')}
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canExport || isExportingZip}
            onSelect={exportClassroomZip}
            className="cursor-pointer gap-2.5"
            title={canExport ? undefined : t('export.mediaPending')}
          >
            <Archive className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <div>{t('export.classroomZip')}</div>
              <div className="text-[11px] text-muted-foreground">
                {t('export.classroomZipDesc')}
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              disabled={!canExport}
              title={canExport ? undefined : t('export.mediaPending')}
              className="cursor-pointer gap-2.5"
            >
              <NotebookText className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>{t('export.script')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[240px]">
              <DropdownMenuItem
                disabled={!canExport || isExportingScript}
                onSelect={exportScriptMd}
                className="cursor-pointer gap-2.5"
              >
                <NotebookText className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div>
                  <div>{t('export.scriptMd')}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t('export.scriptMdDesc')}
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canExport || isExportingScript}
                onSelect={exportScriptDocx}
                className="cursor-pointer gap-2.5"
              >
                <NotebookText
                  className="w-4 h-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <div>{t('export.scriptDocx')}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t('export.scriptDocxDesc')}
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {videoExportEnabled && (
            <DropdownMenuItem
              disabled={!canExport}
              onSelect={() => setVideoDialogOpen(true)}
              className="cursor-pointer gap-2.5 border-t border-border"
              title={canExport ? undefined : t('export.mediaPending')}
            >
              <Film className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <div>{t('export.video')}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t('export.videoDesc')}
                </div>
              </div>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {videoExportEnabled && (
        <VideoExportDialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen} />
      )}
    </div>
  );
}
