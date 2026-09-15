import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'workspace-panel flex flex-col items-center px-6 py-10 text-center sm:py-12',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          {icon}
        </div>
      )}
      <h2 className="text-xl font-semibold leading-7 tracking-tight">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
