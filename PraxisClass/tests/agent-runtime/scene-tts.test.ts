import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  providers: vi.fn(),
  generate: vi.fn(),
  persist: vi.fn(),
  model: vi.fn(() => ''),
}));

vi.mock('@/lib/server/provider-config', () => ({
  getServerTTSProviders: mocks.providers,
  resolveTTSApiKey: vi.fn(() => ''),
  resolveTTSBaseUrl: vi.fn(() => undefined),
  resolveTTSModel: mocks.model,
}));

vi.mock('@/lib/audio/tts-providers', () => ({ generateTTS: mocks.generate }));

vi.mock('@/lib/server/classroom-media-bytes', () => ({
  persistClassroomMediaBytes: mocks.persist,
}));

import { synthesizeSceneNarration } from '@/lib/server/agent-runtime/scene-tts';
import type { Scene } from '@/lib/types/stage';
import { withRuntimeServiceSettings } from '@/lib/server/provider-request-context';

const scene = {
  id: 'scene-a',
  stageId: 'stage-a',
  order: 1,
  title: 'A',
  type: 'slide',
  content: { type: 'slide' },
  actions: [{ id: 'speech-a', type: 'speech', text: 'Hello' }],
} as Scene;

describe('scene TTS capability routing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('honors the server capability force-off before synthesis', async () => {
    mocks.providers.mockReturnValue({ 'configured-tts': { disabled: true } });
    const summary = await synthesizeSceneNarration({
      scene: structuredClone(scene),
      force: false,
    });
    expect(summary).toMatchObject({ available: false, changed: false });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('stores generated narration bytes in classroom media', async () => {
    mocks.providers.mockReturnValue({ 'configured-tts': {} });
    mocks.generate.mockResolvedValue({ audio: new Uint8Array([1, 2]), format: 'mp3' });
    mocks.persist.mockResolvedValue('/api/classroom-media/stage-a/media/tts-speech-a-abc123.mp3');
    const target = structuredClone(scene);
    const summary = await synthesizeSceneNarration({ scene: target, force: false });
    expect(summary).toMatchObject({ available: true, changed: true, generated: 1 });
    // The durable reference is the RELATIVE classroom-media path (origin-
    // independent), stamped on both `audioId` and the legacy `audioUrl` pair
    // the browser's narration consumers resolve (timeline status/preview,
    // playback fetch, exports) — so agent-generated narration is voiced and
    // playable on any deployment origin.
    expect(target.actions?.[0]).toMatchObject({
      audioId: '/api/classroom-media/stage-a/media/tts-speech-a-abc123.mp3',
      audioUrl: '/api/classroom-media/stage-a/media/tts-speech-a-abc123.mp3',
    });
    expect(mocks.persist).toHaveBeenCalledWith(
      expect.objectContaining({ stageId: 'stage-a', mime: 'audio/mpeg' }),
    );
  });

  it('uses the selected model, voice and speed for native narration', async () => {
    mocks.providers.mockReturnValue({ 'custom-tts-review': {} });
    mocks.model.mockReturnValue('selected-model');
    mocks.generate.mockResolvedValue({ audio: new Uint8Array([1, 2]), format: 'mp3' });
    mocks.persist.mockResolvedValue('/api/classroom-media/stage-a/media/selected.mp3');
    await withRuntimeServiceSettings(
      {
        version: 1,
        role: 'teacher',
        llm: { providerId: 'deepseek', apiKey: 'test' },
        tts: {
          providerId: 'custom-tts-review',
          apiKey: '',
          modelId: 'selected-model',
          voice: 'selected-voice',
          speed: 1.2,
        },
      },
      () => synthesizeSceneNarration({ scene: structuredClone(scene), force: false }),
    );
    expect(mocks.model).toHaveBeenCalledWith(
      'custom-tts-review',
      'selected-model',
      'selected-voice',
    );
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'selected-model', voice: 'selected-voice', speed: 1.2 }),
      'Hello',
    );
  });
});
