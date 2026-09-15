'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, PenLine, Repeat, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/hooks/use-i18n';
import { DEFAULT_BRAND } from '@/lib/brand/brand-config';
import { cn } from '@/lib/utils';
import type { PlatformMode } from '@/lib/types/settings';
import { getNavItems, isNavItemActive, platformHomeHref } from './nav-config';

interface PlatformSidebarProps {
  mode: PlatformMode;
  onModeChange: (mode: PlatformMode) => void;
  onOpenSettings: () => void;
  onNavigate?: () => void;
  className?: string;
}

export function PlatformSidebar({
  mode,
  onModeChange,
  onOpenSettings,
  onNavigate,
  className,
}: PlatformSidebarProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const items = getNavItems(mode);
  const navigationGroups = [
    items.filter((item) =>
      ['teacherHome', 'courses', 'dashboard', 'myCourses', 'learning', 'feedback'].includes(
        item.key,
      ),
    ),
    items.filter((item) => ['knowledge', 'schedule', 'astronclaw', 'xingchen'].includes(item.key)),
  ].filter((group) => group.length > 0);

  const handleSwitchRole = () => {
    onNavigate?.();
    if (mode === 'student') {
      router.push('/portal');
      return;
    }
    onModeChange('student');
    router.push(platformHomeHref('student'));
  };

  const itemClass = (active: boolean) =>
    cn(
      'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg px-4 py-2 text-left text-base leading-6 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      active
        ? 'bg-accent text-accent-foreground font-medium'
        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    );

  return (
    <div
      data-platform-sidebar
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border/70 bg-sidebar text-sidebar-foreground',
        className,
      )}
    >
      <Link
        href={platformHomeHref(mode)}
        onClick={onNavigate}
        className="flex min-h-18 shrink-0 items-center gap-3 px-5 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring"
      >
        <img src={DEFAULT_BRAND.markSrc} alt="" className="size-8 shrink-0" />
        <div className="min-w-0 space-y-0.5">
          <span className="block truncate text-base font-semibold tracking-tight">
            {DEFAULT_BRAND.shortName}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t(
              mode === 'teacher'
                ? 'platform.design.teachingSpace'
                : 'platform.design.learningSpace',
            )}
          </span>
        </div>
      </Link>

      {mode === 'teacher' && (
        <div className="px-3 pb-4 pt-2">
          <Button
            asChild
            variant="outline"
            className="h-11 w-full justify-start gap-3 rounded-lg bg-card px-4 text-base shadow-none"
          >
            <Link href="/" onClick={onNavigate}>
              <PenLine className="size-4 text-primary" />
              {t('platform.design.newCourse')}
            </Link>
          </Button>
        </div>
      )}

      <nav
        aria-label={t('platform.design.navigation')}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"
      >
        {navigationGroups.map((group, groupIndex) => (
          <div
            key={group[0].key}
            className={cn(
              'space-y-1',
              groupIndex > 0 && 'mt-4 border-t border-sidebar-border/70 pt-4',
            )}
          >
            {group.map((item) => {
              const label = t(
                item.key === 'feedback' ? 'studentLearning.feedback' : `platform.nav.${item.key}`,
              );
              const Icon = item.icon;

              if (item.externalHref) {
                return (
                  <a
                    key={item.key}
                    href={item.externalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onNavigate}
                    className={itemClass(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                    <ArrowUpRight className="ml-auto size-3.5 opacity-60" aria-hidden="true" />
                  </a>
                );
              }

              return (
                <Link
                  key={item.key}
                  href={item.href ?? '/'}
                  onClick={onNavigate}
                  className={itemClass(isNavItemActive(pathname, item))}
                  aria-current={isNavItemActive(pathname, item) ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mx-3 shrink-0 space-y-1 border-t border-sidebar-border/70 py-3">
        <button
          type="button"
          className={itemClass(false)}
          onClick={() => {
            onNavigate?.();
            onOpenSettings();
          }}
        >
          <Settings className="size-4 shrink-0" />
          <span>{t('platform.nav.settings')}</span>
        </button>
        <button type="button" className={itemClass(false)} onClick={handleSwitchRole}>
          <Repeat className="size-4 shrink-0" />
          {t(mode === 'student' ? 'platform.student.goToPortal' : 'platform.nav.switchRole')}
        </button>
      </div>
    </div>
  );
}
