import type { SettingsState } from '@/lib/store/settings';
import type { ProviderId } from '@/lib/ai/providers';
import { isLLMProviderConfigured } from '@/lib/store/settings-validation';
import { isTTSProviderConfigured } from '@/lib/audio/provider-enablement';
import { ASR_PROVIDERS } from '@/lib/audio/constants';
import type { ASRProviderId, TTSProviderId } from '@/lib/audio/types';
import { IMAGE_PROVIDERS } from '@/lib/media/image-providers';
import { VIDEO_PROVIDERS } from '@/lib/media/video-providers';
import type { ImageProviderId, VideoProviderId } from '@/lib/media/types';
import type { PDFProviderId } from '@/lib/pdf/types';
import { WEB_SEARCH_PROVIDERS, isWebSearchProviderConfigured } from '@/lib/web-search/constants';
import type { WebSearchProviderId } from '@/lib/web-search/types';

export type ServiceSection = 'providers' | 'image' | 'video' | 'tts' | 'asr' | 'pdf' | 'web-search';
export const SERVICE_SECTIONS: readonly string[] = [
  'providers',
  'image',
  'video',
  'tts',
  'asr',
  'pdf',
  'web-search',
];

export function currentServiceProvider(s: SettingsState, section: ServiceSection): string {
  return {
    providers: s.providerId,
    image: s.imageProviderId,
    video: s.videoProviderId,
    tts: s.ttsProviderId,
    asr: s.asrProviderId,
    pdf: s.pdfProviderId,
    'web-search': s.webSearchProviderId,
  }[section];
}

export function serviceEnabled(s: SettingsState, section: ServiceSection): boolean {
  return {
    providers: !!s.modelId,
    image: s.imageGenerationEnabled,
    video: s.videoGenerationEnabled,
    tts: s.ttsEnabled,
    asr: s.asrEnabled,
    pdf: true,
    'web-search': s.webSearchEnabled,
  }[section];
}

/** Configuration readiness, before the user's explicit enable action. No network probe implied. */
export function serviceConfigurationIssue(
  s: SettingsState,
  section: ServiceSection,
  id: string,
): string | null {
  if (!id) return '请先选择服务商。';
  const missing = '请先填写此服务的必要配置，再启用。';
  switch (section) {
    case 'providers': {
      const cfg = s.providersConfig[id as ProviderId];
      return cfg && isLLMProviderConfigured(cfg) ? null : '请先填写模型服务配置并添加可用模型。';
    }
    case 'tts': {
      const cfg = s.ttsProvidersConfig[id as TTSProviderId];
      return !cfg?.serverDisabled && isTTSProviderConfigured(id as TTSProviderId, cfg)
        ? null
        : missing;
    }
    case 'asr': {
      const cfg = s.asrProvidersConfig[id as ASRProviderId];
      const def = ASR_PROVIDERS[id as keyof typeof ASR_PROVIDERS];
      const keyless = cfg?.requiresApiKey === false || def?.requiresApiKey === false;
      const ready =
        id === 'browser-native' ||
        cfg?.isServerConfigured ||
        (keyless ? !!(cfg?.baseUrl || cfg?.customDefaultBaseUrl) : !!cfg?.apiKey?.trim());
      return ready && !cfg?.serverDisabled ? null : missing;
    }
    case 'image':
    case 'video': {
      const def =
        section === 'image'
          ? IMAGE_PROVIDERS[id as ImageProviderId]
          : VIDEO_PROVIDERS[id as VideoProviderId];
      const cfg =
        section === 'image'
          ? s.imageProvidersConfig[id as ImageProviderId]
          : s.videoProvidersConfig[id as VideoProviderId];
      return def &&
        !cfg?.serverDisabled &&
        (cfg?.isServerConfigured ||
          (def.requiresApiKey ? !!cfg?.apiKey?.trim() : !!cfg?.baseUrl?.trim()))
        ? null
        : missing;
    }
    case 'pdf': {
      const cfg = s.pdfProvidersConfig[id as PDFProviderId];
      if (id === 'unpdf' || cfg?.isServerConfigured) return null;
      if (id === 'alidocmind') return cfg?.accessKeyId && cfg?.accessKeySecret ? null : missing;
      return (id === 'mineru' ? cfg?.baseUrl : cfg?.apiKey) ? null : missing;
    }
    case 'web-search': {
      const def = WEB_SEARCH_PROVIDERS[id as WebSearchProviderId];
      return def && isWebSearchProviderConfigured(def, s.webSearchProvidersConfig[def.id])
        ? null
        : missing;
    }
  }
}

export function activateService(
  s: SettingsState,
  section: ServiceSection,
  id: string,
  model?: string,
): void {
  const issue = serviceConfigurationIssue(s, section, id);
  if (issue) throw new Error(issue);
  if ((section === 'providers' || section === 'image' || section === 'video') && !model) {
    throw new Error(
      section === 'image' && id === 'comfyui-image' ? '请选择 ComfyUI 工作流。' : '请选择模型。',
    );
  }
  switch (section) {
    case 'providers':
      s.setModel(id as ProviderId, model!);
      break;
    case 'tts':
      s.setTTSProviderConfig(id as TTSProviderId, { enabled: true });
      s.setTTSProvider(id as TTSProviderId);
      s.setTTSEnabled(true);
      break;
    case 'asr':
      s.setASRProviderConfig(id as ASRProviderId, { enabled: true });
      s.setASRProvider(id as ASRProviderId);
      s.setASREnabled(true);
      break;
    case 'image':
      s.setImageProviderConfig(id as ImageProviderId, { enabled: true });
      s.setImageProvider(id as ImageProviderId);
      s.setImageModelId(model!);
      s.setImageGenerationEnabled(true);
      break;
    case 'video':
      s.setVideoProviderConfig(id as VideoProviderId, { enabled: true });
      s.setVideoProvider(id as VideoProviderId);
      s.setVideoModelId(model!);
      s.setVideoGenerationEnabled(true);
      break;
    case 'pdf':
      s.setPDFProviderConfig(id as PDFProviderId, { enabled: true });
      s.setPDFProvider(id as PDFProviderId);
      break;
    case 'web-search':
      s.setWebSearchProviderConfig(id as WebSearchProviderId, { enabled: true });
      s.setWebSearchProvider(id as WebSearchProviderId);
      s.setWebSearchEnabled(true);
      break;
  }
}

export function disableService(s: SettingsState, section: ServiceSection): void {
  switch (section) {
    case 'tts':
      s.setTTSEnabled(false);
      break;
    case 'asr':
      s.setASREnabled(false);
      break;
    case 'image':
      s.setImageGenerationEnabled(false);
      break;
    case 'video':
      s.setVideoGenerationEnabled(false);
      break;
    case 'web-search':
      s.setWebSearchEnabled(false);
      break;
  }
}
