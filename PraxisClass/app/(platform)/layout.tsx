import type { Metadata } from 'next';
import { PlatformShell } from '@/components/platform/platform-shell';
import { DEFAULT_BRAND } from '@/lib/brand/brand-config';

export const metadata: Metadata = {
  title: DEFAULT_BRAND.productName,
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
