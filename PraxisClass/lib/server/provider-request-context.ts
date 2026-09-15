import { AsyncLocalStorage } from 'node:async_hooks';
import type { ServiceSettingsSnapshot } from '@/lib/types/service-settings';

const contextKey = Symbol.for('praxis.provider-request-context');
type ProviderContext = { personal: boolean; settings?: ServiceSettingsSnapshot };
const host = globalThis as typeof globalThis & {
  [contextKey]?: AsyncLocalStorage<ProviderContext>;
};
const context = (host[contextKey] ??= new AsyncLocalStorage<ProviderContext>());
export function usesPersonalProviderConfig() {
  return context.getStore()?.personal === true;
}
export function withPersonalProviderConfig<T>(work: () => T): T {
  return context.run({ ...context.getStore(), personal: true }, work);
}
export function getRuntimeServiceSettings() {
  return context.getStore()?.settings;
}
export function withRuntimeServiceSettings<T>(settings: ServiceSettingsSnapshot, work: () => T): T {
  return context.run({ personal: true, settings }, work);
}

export async function runWithProviderRequest<T>(
  request: Request,
  work: () => T,
): Promise<Awaited<T>> {
  let personal = ['teacher', 'student'].includes(request.headers.get('x-praxis-role') || '');
  const keyHeaders = [
    'x-api-key',
    'x-tts-api-key',
    'x-asr-api-key',
    'x-image-api-key',
    'x-video-api-key',
  ];
  personal ||= keyHeaders.some((header) => !!request.headers.get(header));
  if (!personal && request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await request.clone().json();
      personal = ['apiKey', 'ttsApiKey', 'asrApiKey', 'accessKeyId'].some(
        (field) => !!body?.[field],
      );
    } catch {
      /* The route owns malformed-body reporting. */
    }
  }
  return await context.run({ personal }, work);
}

export function withProviderRequest<R extends Request, T>(handler: (request: R) => T) {
  return (request: R) => runWithProviderRequest(request, () => handler(request));
}
