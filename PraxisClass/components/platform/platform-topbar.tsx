'use client';

import { Menu, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogTrigger } from '@/components/ui/dialog';
import { useI18n } from '@/lib/hooks/use-i18n';
import { BrandLogo } from '@/components/brand-logo';
import type { PlatformMode } from '@/lib/types/settings';
import { ReminderBell } from './reminder-bell';
import { getNavItems, isNavItemActive } from './nav-config';

interface PlatformTopbarProps {
  mode: PlatformMode;
  onOpenSettings: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function PlatformTopbar({
  mode,
  onOpenSettings,
  sidebarOpen,
  onToggleSidebar,
}: PlatformTopbarProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const currentItem = getNavItems(mode).find((item) => isNavItemActive(pathname, item));

  return (
    <header
      data-platform-topbar
      className="mx-5 mt-3 flex h-16 shrink-0 items-center gap-3 bg-background px-3 sm:mx-8 sm:px-5"
    >
      <Button
        variant="ghost"
        size="icon"
        className="hidden size-11 rounded-xl md:inline-flex"
        onClick={onToggleSidebar}
        aria-expanded={sidebarOpen}
        aria-label={t('platform.workbench.toggleNavigation')}
      >
        {sidebarOpen ? <PanelLeftClose className="size-5" /> : <PanelLeftOpen className="size-5" />}
      </Button>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t('platform.toggleSidebar')}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <BrandLogo size="sm" className="md:hidden" />
      <div className="hidden min-w-0 items-center gap-3 text-xs text-muted-foreground md:flex">
        <span>
          {t(
            mode === 'teacher' ? 'platform.design.teachingSpace' : 'platform.design.learningSpace',
          )}
        </span>
        {currentItem && (
          <>
            <span aria-hidden="true" className="text-border">
              /
            </span>
            <span className="truncate text-foreground">{t(`platform.nav.${currentItem.key}`)}</span>
          </>
        )}
      </div>

      <div className="flex-1" />

      <Badge
        variant="secondary"
        className="hidden rounded-full px-2.5 py-1 text-xs font-normal sm:inline-flex"
      >
        {mode === 'teacher' ? t('platform.role.teacher') : t('platform.role.student')}
      </Badge>

      <ReminderBell enabled={mode === 'teacher'} />

      <Button variant="ghost" size="icon" onClick={onOpenSettings} aria-label={t('settings.title')}>
        <Settings className="h-4 w-4" />
      </Button>
    </header>
  );
}
