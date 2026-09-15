import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentServiceSettings } from '@/lib/settings/service-snapshot';

const mocks = vi.hoisted(() => ({ state: {} as Record<string, unknown>, role: 'teacher' }));
vi.mock('@/lib/store/settings', () => ({ useSettingsStore: { getState: () => mocks.state } }));
vi.mock('@/lib/store/settings-mode', () => ({
  useSettingsMode: { getState: () => ({ mode: mocks.role }) },
}));
vi.mock('@/lib/utils/model-config', () => ({
  getCurrentModelConfig: () => ({
    providerId: 'deepseek',
    modelId: 'deepseek-v4-pro',
    apiKey: 'local-test',
    thinkingConfig: { mode: 'disabled' },
  }),
}));

afterEach(() => {
  mocks.role = 'teacher';
});

describe('current settings sent to background tasks', () => {
  it('uses the current selected LLM and excludes credentials from disabled services', () => {
    mocks.state = {
      ttsProviderId: 'qwen-tts',
      ttsEnabled: false,
      ttsProvidersConfig: { 'qwen-tts': { enabled: true, apiKey: 'unused-tts' } },
      asrProviderId: '',
      asrProvidersConfig: {},
      pdfProviderId: 'unpdf',
      pdfProvidersConfig: { unpdf: { enabled: true, apiKey: '' } },
      imageProviderId: 'openai-image',
      imageGenerationEnabled: false,
      imageProvidersConfig: { 'openai-image': { enabled: true, apiKey: 'unused-image' } },
      videoProviderId: '',
      videoProvidersConfig: {},
      webSearchProviderId: 'tavily',
      webSearchEnabled: true,
      webSearchProvidersConfig: { tavily: { enabled: true, apiKey: 'search-test' } },
    };
    const snapshot = currentServiceSettings();
    expect(snapshot.llm.modelId).toBe('deepseek-v4-pro');
    expect(snapshot.llm.thinkingConfig).toEqual({ mode: 'disabled' });
    expect(snapshot.webSearch?.providerId).toBe('tavily');
    expect(snapshot.pdf?.providerId).toBe('unpdf');
    expect(snapshot.tts).toBeUndefined();
    expect(snapshot.image).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain('unused-');
    mocks.role = 'student';
    expect(currentServiceSettings().role).toBe('student');
  });

  it('keeps the selected recognition language and search sources', () => {
    mocks.state = {
      ...mocks.state,
      asrEnabled: true,
      asrProviderId: 'openai-whisper',
      asrLanguage: 'zh',
      asrProvidersConfig: {
        'openai-whisper': { enabled: true, apiKey: 'asr-test', modelId: 'whisper-1' },
      },
      webSearchEnabled: true,
      webSearchProviderId: 'baidu',
      webSearchProvidersConfig: { baidu: { enabled: true, apiKey: 'search-test' } },
      baiduSubSources: { webSearch: false, baike: false, scholar: true },
    };
    expect(currentServiceSettings()).toMatchObject({
      asr: { language: 'zh', modelId: 'whisper-1' },
      webSearch: { baiduSubSources: { webSearch: false, baike: false, scholar: true } },
    });
  });
});
