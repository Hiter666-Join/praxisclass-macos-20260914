import type { ThinkingConfig } from './provider';
import type { BaiduSubSources } from '@/lib/web-search/types';

/** Execution copy of the existing settings centre; never model-visible. */
export interface ServiceSelection {
  providerId: string;
  apiKey: string;
  baseUrl?: string;
  modelId?: string;
  providerType?: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  providerOptions?: Record<string, unknown>;
}

export interface ServiceSettingsSnapshot {
  version: 1;
  role: 'teacher' | 'student';
  llm: ServiceSelection & { thinkingConfig?: ThinkingConfig };
  tts?: ServiceSelection & { voice?: string; speed?: number };
  asr?: ServiceSelection & { language?: string };
  pdf?: ServiceSelection;
  image?: ServiceSelection;
  video?: ServiceSelection;
  webSearch?: ServiceSelection & { baiduSubSources?: BaiduSubSources };
}
