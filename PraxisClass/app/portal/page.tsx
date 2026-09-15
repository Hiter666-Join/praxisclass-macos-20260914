import { Suspense } from 'react';
import { PortalEntry } from '@/components/platform/portal-entry';

export const dynamic = 'force-dynamic';

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] w-full bg-background" />}>
      <PortalEntry />
    </Suspense>
  );
}
