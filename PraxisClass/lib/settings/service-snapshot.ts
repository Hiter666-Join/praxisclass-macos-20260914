import { useSettingsStore } from '@/lib/store/settings';
import { useSettingsMode } from '@/lib/store/settings-mode';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import type { ServiceSelection, ServiceSettingsSnapshot } from '@/lib/types/service-settings';

/** Read at send time, so old and new workbench entry points use current settings. */
export function currentServiceSettings(): ServiceSettingsSnapshot {
  const state = useSettingsStore.getState();
  const model = getCurrentModelConfig();
  const selected = (
    providerId: string,
    enabled: boolean,
    config:
      | {
          apiKey: string;
          baseUrl?: string;
          enabled: boolean;
          serverDisabled?: boolean;
          modelId?: string;
          accessKeyId?: string;
          accessKeySecret?: string;
          providerOptions?: Record<string, unknown>;
        }
      | undefined,
    modelId?: string,
  ): ServiceSelection | undefined =>
    enabled && providerId && config?.enabled && !config.serverDisabled
      ? {
          providerId,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          modelId: modelId || config.modelId,
          accessKeyId: config.accessKeyId,
          accessKeySecret: config.accessKeySecret,
          providerOptions: config.providerOptions,
        }
      : undefined;
  const tts = selected(
    state.ttsProviderId,
    state.ttsEnabled,
    state.ttsProvidersConfig[state.ttsProviderId],
  );
  const asr = selected(
    state.asrProviderId,
    state.asrEnabled,
    state.asrProvidersConfig[state.asrProviderId],
  );
  const webSearch = selected(
    state.webSearchProviderId,
    state.webSearchEnabled,
    state.webSearchProvidersConfig[state.webSearchProviderId],
  );
  return {
    version: 1,
    role: useSettingsMode.getState().mode,
    llm: {
      providerId: model.providerId,
      modelId: model.modelId,
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      providerType: model.providerType,
      thinkingConfig: model.thinkingConfig,
    },
    tts: tts ? { ...tts, voice: state.ttsVoice, speed: state.ttsSpeed } : undefined,
    asr: asr ? { ...asr, language: state.asrLanguage } : undefined,
    pdf: selected(state.pdfProviderId, true, state.pdfProvidersConfig[state.pdfProviderId]),
    image: selected(
      state.imageProviderId,
      state.imageGenerationEnabled,
      state.imageProvidersConfig[state.imageProviderId],
      state.imageModelId,
    ),
    video: selected(
      state.videoProviderId,
      state.videoGenerationEnabled,
      state.videoProvidersConfig[state.videoProviderId],
      state.videoModelId,
    ),
    webSearch: webSearch
      ? {
          ...webSearch,
          ...(webSearch.providerId === 'baidu' ? { baiduSubSources: state.baiduSubSources } : {}),
        }
      : undefined,
  };
}
