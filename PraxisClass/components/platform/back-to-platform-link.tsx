'use client';

import Link from 'next/link';
import { House } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';
import { platformHomeHref, usePlatformMode } from './nav-config';

export function BackToPlatformLink({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const { mode } = usePlatformMode();

  return (
    <Button
      variant="outline"
      asChild
      className={cn(
        'min-h-11 shadow-none active:bg-accent active:text-accent-foreground',
        compact && 'h-14 w-12 flex-col gap-1 rounded-xl px-0 py-1.5 text-[11px] leading-4',
        className,
      )}
    >
      <Link href={platformHomeHref(mode)} aria-label={t('platform.backToPlatform')}>
        <House className="size-4" aria-hidden="true" />
        <span>{t(compact ? 'platform.homeLabel' : 'platform.backToPlatform')}</span>
      </Link>
    </Button>
  );
}
