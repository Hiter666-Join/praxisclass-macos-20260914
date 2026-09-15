import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildVocationalGenerationContext,
  withVocationalGenerationContext,
} from '@/lib/server/vocational-generation-context';
import type { SceneOutline, UserRequirements } from '@/lib/types/generation';

const outline = (name: string, type: SceneOutline['type'] = 'slide'): SceneOutline => ({
  id: name,
  title: name,
  type,
  description: name,
  keyPoints: [name],
  order: 1,
});
const requirements = (taskEngineMode?: boolean): UserRequirements => ({
  requirement: '接口验收',
  taskEngineMode,
});

afterEach(() => vi.unstubAllEnvs());

describe('request-local vocational continuity', () => {
  test('page changes preserve the complete common guidance and course plan prefix', () => {
    vi.stubEnv('PRAXIS_ENABLE_VOCATIONAL', 'true');
    const a = outline('准备检查');
    const b = { ...outline('交付验收'), order: 2 };
    const plan = [a, b];
    const first = withVocationalGenerationContext(
      'FIRST_PAGE_CONTENT',
      buildVocationalGenerationContext(requirements(true), a, plan),
    );
    const second = withVocationalGenerationContext(
      'SECOND_PAGE_CONTENT',
      buildVocationalGenerationContext(requirements(true), b, plan),
    );
    const prefix = first.slice(0, first.indexOf('Current page:'));
    expect(prefix).toContain('Course plan (reference data):');
    expect(prefix).toContain('交付验收');
    expect(second.startsWith(prefix)).toBe(true);
    expect(first.endsWith('FIRST_PAGE_CONTENT')).toBe(true);
    expect(second.endsWith('SECOND_PAGE_CONTENT')).toBe(true);
    expect(withVocationalGenerationContext('ordinary course', '')).toBe('ordinary course');
  });

  test('requires both gates; off and missing mode add no prompt text', () => {
    const page = outline('普通课');
    vi.stubEnv('PRAXIS_ENABLE_VOCATIONAL', 'false');
    expect(buildVocationalGenerationContext(requirements(true), page, [page])).toBe('');
    vi.stubEnv('PRAXIS_ENABLE_VOCATIONAL', 'true');
    expect(buildVocationalGenerationContext(requirements(false), page, [page])).toBe('');
    expect(buildVocationalGenerationContext(requirements(), page, [page])).toBe('');
    expect(buildVocationalGenerationContext(undefined, page, [page])).toBe('');
  });

  test('on then off and interleaved cases retain no shared course context', async () => {
    vi.stubEnv('PRAXIS_ENABLE_VOCATIONAL', 'true');
    const a = outline('CASE_A', 'quiz');
    const b = outline('CASE_B', 'pbl');
    const result = await Promise.all(
      [a, b, a].map(async (page) =>
        buildVocationalGenerationContext(requirements(true), page, [page]),
      ),
    );
    expect(result[0]).toContain('CASE_A');
    expect(result[0]).not.toContain('CASE_B');
    expect(result[1]).toContain('CASE_B');
    expect(result[1]).not.toContain('CASE_A');
    expect(result[0]).toBe(result[2]);
    expect(buildVocationalGenerationContext(requirements(false), a, [a])).toBe('');
  });
});
