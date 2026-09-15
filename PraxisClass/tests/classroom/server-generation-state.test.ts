import { describe, expect, it } from 'vitest';
import { serverGenerationPresentation } from '@/lib/classroom/server-generation-state';
import type { SceneOutline } from '@/lib/types/generation';

const outlines = [1, 2, 3].map((order) => ({ id: `p${order}`, order, type: 'slide', title: `Page ${order}`, description: '', keyPoints: [] })) as SceneOutline[];
describe('stopped Pro classroom presentation', () => {
  it.each(['cancelled', 'failed', 'succeeded'])('does not show pending pages for a %s producer', (status) => {
    expect(serverGenerationPresentation(status, outlines, [{ order: 1 }, { order: 2 }])).toEqual({ generationStatus: 'paused', generatingOutlines: [] });
    expect(outlines).toHaveLength(3);
  });
  it('restores only missing placeholders when the producer really resumes', () => {
    expect(serverGenerationPresentation('running', outlines, [{ order: 1 }, { order: 2 }])).toEqual({ generationStatus: 'generating', generatingOutlines: [outlines[2]] });
  });
});
