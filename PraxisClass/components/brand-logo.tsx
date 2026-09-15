import type { ComponentProps } from 'react';
import { DEFAULT_BRAND, type BrandConfig } from '@/lib/brand/brand-config';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'gap-2 text-base [&_img]:size-7',
  md: 'gap-2.5 text-xl [&_img]:size-9',
  lg: 'gap-3 text-3xl [&_img]:size-14',
};

/** Keep the wordmark as text so it stays sharp in compact and enlarged chrome. */
export function BrandLogo({
  brand = DEFAULT_BRAND,
  size = 'md',
  className,
  ...props
}: Omit<ComponentProps<'span'>, 'children'> & {
  brand?: BrandConfig;
  size?: keyof typeof sizes;
}) {
  return (
    <span
      role="img"
      aria-label={brand.productName}
      className={cn(
        'inline-flex min-w-0 shrink-0 items-center whitespace-nowrap font-semibold leading-none tracking-[0.04em] text-foreground',
        sizes[size],
        className,
      )}
      {...props}
    >
      <img src={brand.markSrc} alt="" className="shrink-0 object-contain" />
      <span aria-hidden="true">{brand.shortName}</span>
    </span>
  );
}
