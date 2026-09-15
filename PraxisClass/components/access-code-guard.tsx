'use client';

import type { ReactNode } from 'react';

export function AccessCodeGuard({ children }: { children: ReactNode }) {
  // Passwordless Demo: keep the existing layout seam without a network-dependent login modal.
  return children;
}
