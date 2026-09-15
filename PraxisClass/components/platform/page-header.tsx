import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-3xl space-y-2.5">
        {eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}
        <h1 className="text-balance text-[30px] font-semibold leading-tight tracking-tight sm:text-[34px]">
          {title}
        </h1>
        {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
