import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/lib/store/settings';
import { activateService, serviceConfigurationIssue } from '@/lib/settings/service-activation';

beforeEach(() => {
  for (const mode of ['teacher', 'student'] as const) {
    useSettingsStore.getState().setMode(mode);
    useSettingsStore.setState(useSettingsStore.getInitialState());
  }
  useSettingsStore.getState().setMode('teacher');
});
describe('current-side service activation', () => {
  it('activates configured services in the current side without a homepage visit', () => {
    const s = useSettingsStore.getState();
    s.setProviderConfig('openai', { apiKey: 'test', baseUrl: 'https://example.test/v1' });
    activateService(useSettingsStore.getState(), 'providers', 'openai', 'gpt-4o');
    s.setImageProviderConfig('comfyui-image', { baseUrl: 'http://127.0.0.1:8188' });
    activateService(useSettingsStore.getState(), 'image', 'comfyui-image', 'test-workflow');
    s.setVideoProviderConfig('kling', { apiKey: 'video-test' });
    activateService(useSettingsStore.getState(), 'video', 'kling', 'test-model');
    activateService(useSettingsStore.getState(), 'tts', 'browser-native-tts');
    activateService(useSettingsStore.getState(), 'asr', 'browser-native');
    s.setPDFProviderConfig('mineru', { baseUrl: 'http://127.0.0.1:8000' });
    activateService(useSettingsStore.getState(), 'pdf', 'mineru');
    activateService(useSettingsStore.getState(), 'web-search', 'brave');
    expect(useSettingsStore.getState()).toMatchObject({
      providerId: 'openai',
      modelId: 'gpt-4o',
      imageProviderId: 'comfyui-image',
      imageModelId: 'test-workflow',
      imageGenerationEnabled: true,
      videoGenerationEnabled: true,
      ttsEnabled: true,
      asrEnabled: true,
      pdfProviderId: 'mineru',
      webSearchEnabled: true,
    });
    s.setMode('student');
    expect(useSettingsStore.getState()).toMatchObject({
      providerId: '',
      imageGenerationEnabled: false,
      videoGenerationEnabled: false,
      ttsEnabled: false,
      asrEnabled: false,
      webSearchEnabled: false,
    });
    expect(useSettingsStore.getState().imageProvidersConfig['comfyui-image'].baseUrl).toBe('');
    useSettingsStore.getState().setMode('teacher');
    expect(useSettingsStore.getState().webSearchEnabled).toBe(true);
  });
  it('does not enable an unconfigured selected service because another provider has a key', () => {
    const s = useSettingsStore.getState();
    s.setImageProviderConfig('qwen-image', { apiKey: 'configured-other' });
    s.setImageProvider('seedream');
    s.setImageGenerationEnabled(true);
    expect(useSettingsStore.getState().imageGenerationEnabled).toBe(false);
    expect(
      serviceConfigurationIssue(useSettingsStore.getState(), 'image', 'seedream'),
    ).not.toBeNull();
    expect(() => activateService(useSettingsStore.getState(), 'tts', 'xfyun-tts')).toThrow();
  });
});
