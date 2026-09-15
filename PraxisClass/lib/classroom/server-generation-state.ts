import type { SceneOutline } from '@/lib/types/generation';

export function serverGenerationPresentation(
  status: string,
  outlines: SceneOutline[],
  scenes: readonly { order: number }[],
) {
  const active = status === 'queued' || status === 'running';
  return {
    generationStatus: active ? 'generating' as const : 'paused' as const,
    generatingOutlines: active ? outlines.filter((outline) => !scenes.some((scene) => scene.order === outline.order)) : [],
  };
}
