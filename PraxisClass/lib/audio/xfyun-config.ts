/** Shared credential shape; keeps all three fields together through existing TTS transports. */
export interface XfyunCredentials {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

export const XFYUN_TTS_ENDPOINT = 'wss://tts-api.xfyun.cn/v2/tts';

export function splitXfyunCredentials(value = ''): XfyunCredentials {
  const [appId = '', apiKey = '', apiSecret = ''] = value.split(':');
  return { appId, apiKey, apiSecret };
}

export function encodeXfyunCredentials(credentials: XfyunCredentials): string {
  return [credentials.appId, credentials.apiKey, credentials.apiSecret]
    .map((value) => value.trim())
    .join(':');
}

export function hasXfyunCredentials(value?: string): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every((part) => !!part.trim() && !/\s/.test(part.trim()));
}
