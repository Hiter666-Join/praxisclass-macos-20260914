import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      </CardContent>
    </Card>
  );
}
