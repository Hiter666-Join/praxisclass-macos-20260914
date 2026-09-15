import { afterEach, describe, expect, it, vi } from 'vitest';

const globals = globalThis as Record<string, unknown>;
const originalContext = globals.__thinkingContext;

afterEach(() => {
  globals.__thinkingContext = originalContext;
  vi.resetModules();
});

describe('thinking context across route module loads', () => {
  it('retains a pending request preference when another route loads the module', async () => {
    delete globals.__thinkingContext;
    vi.resetModules();
    const first = (await import('@/lib/ai/thinking-context')).thinkingContext;
    await first.run({ mode: 'disabled', enabled: false }, async () => {
      vi.resetModules();
      const second = (await import('@/lib/ai/thinking-context')).thinkingContext;
      expect(second.getStore()).toEqual({ mode: 'disabled', enabled: false });
      expect(globals.__thinkingContext).toBe(first);
    });
  });

  it('keeps concurrent caller preferences isolated', async () => {
    vi.resetModules();
    const { thinkingContext } = await import('@/lib/ai/thinking-context');
    const modes = await Promise.all(
      (['enabled', 'disabled'] as const).map((mode) =>
        thinkingContext.run({ mode }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return thinkingContext.getStore()?.mode;
        }),
      ),
    );
    expect(modes).toEqual(['enabled', 'disabled']);
    expect(thinkingContext.getStore()).toBeUndefined();
  });
});
