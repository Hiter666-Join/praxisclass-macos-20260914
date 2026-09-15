'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SettingsDialog } from '@/components/settings';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { PlatformMode } from '@/lib/types/settings';
import { PlatformSidebar } from './platform-sidebar';
import { PlatformTopbar } from './platform-topbar';
import { usePlatformMode } from './nav-config';

const TEACHER_PATH_PREFIXES = ['/teacher', '/dashboard', '/knowledge', '/schedule'];

function modeFromPathname(pathname: string): PlatformMode | null {
  if (TEACHER_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return 'teacher';
  if (pathname.startsWith('/student')) return 'student';
  return null;
}

export function PlatformShell({
  children,
  forcedMode,
  onOpenSettings,
}: {
  children: React.ReactNode;
  forcedMode?: PlatformMode;
  onOpenSettings?: () => void;
}) {
  const { t } = useI18n();
  const { mode, setMode } = usePlatformMode();
  const pathname = usePathname();
  const pathMode = forcedMode ?? modeFromPathname(pathname);
  const effectiveMode = pathMode ?? mode;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const openSettings = onOpenSettings ?? (() => setSettingsOpen(true));

  useEffect(() => {
    if (pathMode && pathMode !== mode) setMode(pathMode);
  }, [pathMode, mode, setMode]);

  return (
    <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <div data-platform-viewport className="flex h-[100dvh] w-full overflow-hidden bg-background">
        <PlatformSidebar
          mode={effectiveMode}
          onModeChange={setMode}
          onOpenSettings={openSettings}
          className={`my-3 ml-3 hidden h-[calc(100%-1.5rem)] w-60 ${sidebarOpen ? 'md:flex' : ''}`}
        />

        <DialogContent
          aria-describedby={undefined}
          showCloseButton={false}
          className="left-3 top-3 block h-[calc(100dvh-1.5rem)] w-64 max-w-[85vw] translate-x-0 translate-y-0 overflow-hidden rounded-3xl p-0 data-open:zoom-in-100 data-closed:zoom-out-100"
        >
          <DialogTitle className="sr-only">{t('platform.design.navigation')}</DialogTitle>
          <PlatformSidebar
            mode={effectiveMode}
            onModeChange={setMode}
            onOpenSettings={() => {
              setMobileNavOpen(false);
              openSettings();
            }}
            onNavigate={() => setMobileNavOpen(false)}
            className="w-full"
          />
        </DialogContent>

        <div className="flex flex-1 flex-col min-w-0">
          <PlatformTopbar
            mode={effectiveMode}
            onOpenSettings={openSettings}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
          />
          <main id="workspace-content" className="flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-7xl px-5 pb-20 pt-6 sm:px-8 lg:pt-8">
              {children}
            </div>
          </main>
        </div>

        {!onOpenSettings && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}
      </div>
    </Dialog>
  );
}
