import type { Queryable } from '@praxis/storage/agent-session/pg';
import type { ServiceSelection, ServiceSettingsSnapshot } from '@/lib/types/service-settings';
import { getServerPersistenceProvider } from '@/lib/persistence/server-provider';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';

// Private column: absent from SESSION_COLUMNS, SSE, transcript, and course export.
export async function ensureRuntimeSettingsSchema(db: Queryable) {
  await db.query('ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS service_settings JSONB');
}

export async function saveRuntimeSettings(
  db: Queryable,
  sessionId: string,
  ownerId: string,
  settings: ServiceSettingsSnapshot,
) {
  await db.query(
    'UPDATE agent_sessions SET service_settings = $3::jsonb WHERE id = $1 AND owner_id = $2',
    [sessionId, ownerId, JSON.stringify(settings)],
  );
}

export async function loadRuntimeSettings(
  sessionId: string,
  ownerId: string,
): Promise<ServiceSettingsSnapshot | undefined> {
  const { pool } = await getServerPersistenceProvider(process.env.DATABASE_URL!);
  const result = await pool.query(
    'SELECT service_settings FROM agent_sessions WHERE id = $1 AND owner_id = $2',
    [sessionId, ownerId],
  );
  return result.rows[0]?.service_settings ?? undefined;
}

/** Only settings data is accepted; no model instructions or server-env fallback. */
export async function parseRuntimeSettings(
  value: unknown,
  role: string | null,
  requireModel = true,
): Promise<ServiceSettingsSnapshot> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('请在设置中选择并启用语言模型，然后重新发送。');
  const input = value as Record<string, unknown>;
  if (
    input.version !== 1 ||
    !['teacher', 'student'].includes(String(input.role)) ||
    (role && input.role !== role)
  ) {
    throw new Error('设置所属端不匹配，请刷新当前页面后重新发送。');
  }
  const selection = async (raw: unknown): Promise<ServiceSelection | undefined> => {
    if (raw == null) return undefined;
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('服务配置格式无效。');
    const item = raw as Record<string, unknown>;
    if (
      typeof item.providerId !== 'string' ||
      !item.providerId.trim() ||
      typeof item.apiKey !== 'string'
    )
      throw new Error('请在设置中选择并启用服务。');
    const parsed: ServiceSelection = { providerId: item.providerId, apiKey: item.apiKey };
    for (const key of [
      'baseUrl',
      'modelId',
      'providerType',
      'accessKeyId',
      'accessKeySecret',
    ] as const) {
      if (item[key] !== undefined) {
        if (typeof item[key] !== 'string' || item[key].length > 8192)
          throw new Error('服务配置格式无效。');
        parsed[key] = item[key];
      }
    }
    if (parsed.baseUrl) {
      const url = new URL(parsed.baseUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('服务地址格式无效。');
      if (process.env.NODE_ENV === 'production') {
        const error = await validateUrlForSSRF(parsed.baseUrl);
        if (error) throw new Error(error);
      }
    }
    if (
      item.providerOptions &&
      typeof item.providerOptions === 'object' &&
      !Array.isArray(item.providerOptions)
    )
      parsed.providerOptions = item.providerOptions as Record<string, unknown>;
    return parsed;
  };
  if (JSON.stringify(value).length > 65536) throw new Error('服务配置过大。');
  const source = input.llm as ServiceSettingsSnapshot['llm'] | undefined;
  const llm =
    !requireModel && !source?.providerId
      ? { providerId: '', apiKey: '' }
      : await selection(input.llm);
  if (requireModel && !llm?.modelId?.trim())
    throw new Error('请在设置中选择并启用语言模型，然后重新发送。');
  const sourceLlm = input.llm as ServiceSettingsSnapshot['llm'];
  const tts = await selection(input.tts);
  const sourceTts = input.tts as ServiceSettingsSnapshot['tts'];
  const asr = await selection(input.asr);
  const sourceAsr = input.asr as ServiceSettingsSnapshot['asr'];
  const webSearch = await selection(input.webSearch);
  const sourceSearch = input.webSearch as ServiceSettingsSnapshot['webSearch'];
  const subSources = sourceSearch?.baiduSubSources;
  if (
    subSources &&
    ['webSearch', 'baike', 'scholar'].some(
      (key) => typeof subSources[key as keyof typeof subSources] !== 'boolean',
    )
  ) {
    throw new Error('搜索来源配置格式无效。');
  }
  return {
    version: 1,
    role: input.role as ServiceSettingsSnapshot['role'],
    llm: {
      providerId: '',
      apiKey: '',
      ...llm,
      ...(sourceLlm?.thinkingConfig ? { thinkingConfig: sourceLlm.thinkingConfig } : {}),
    },
    tts: tts
      ? {
          ...tts,
          voice: typeof sourceTts?.voice === 'string' ? sourceTts.voice : undefined,
          speed: typeof sourceTts?.speed === 'number' ? sourceTts.speed : undefined,
        }
      : undefined,
    asr: asr
      ? {
          ...asr,
          language: typeof sourceAsr?.language === 'string' ? sourceAsr.language : undefined,
        }
      : undefined,
    pdf: await selection(input.pdf),
    image: await selection(input.image),
    video: await selection(input.video),
    webSearch: webSearch
      ? {
          ...webSearch,
          ...(subSources
            ? {
                baiduSubSources: {
                  webSearch: subSources.webSearch,
                  baike: subSources.baike,
                  scholar: subSources.scholar,
                },
              }
            : {}),
        }
      : undefined,
  };
}
