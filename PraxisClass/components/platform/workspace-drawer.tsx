'use client';

import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/hooks/use-i18n';

/** A focused tool sheet. Keep the course list in place when closing it. */
export function WorkspaceDrawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const opener = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-workspace-drawer
        aria-describedby={undefined}
        showCloseButton={false}
        onOpenAutoFocus={() => {
          opener.current = document.activeElement as HTMLElement | null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener.current?.isConnected) opener.current.focus();
        }}
        className="workspace-palette left-auto right-3 top-3 flex h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:w-[34rem] sm:max-w-[calc(100%-1.5rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <DialogTitle className="text-xl font-semibold leading-7">{title}</DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-xl"
              aria-label={t('common.close')}
            >
              <X className="size-5" />
            </Button>
          </DialogClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
