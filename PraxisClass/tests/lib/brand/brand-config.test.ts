import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from '@/lib/brand/brand-config';

describe('DEFAULT_BRAND (single-brand build)', () => {
  it('uses the current product identity for full chrome', () => {
    expect(DEFAULT_BRAND.productName).toBe('真需实创');
    expect(DEFAULT_BRAND.shortName).toBe('真需实创');
    expect(DEFAULT_BRAND.markSrc).toBe('/zhenxu-mark-v2.png');
    expect(DEFAULT_BRAND.themeColor).toBe('#722ed1');
  });

  it('pairs the standalone mark with a live text wordmark', () => {
    expect(DEFAULT_BRAND.logoHasWordmark).toBe(false);
    expect(DEFAULT_BRAND.logoSrc).toBe('/zhenxu-mark-v2.png');
  });
});
