import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PgAgentSessionStore,
  ensureAgentSessionSchema,
  type Queryable,
} from '@praxis/storage/agent-session/pg';
import { withRuntimeServiceSettings } from '@/lib/server/provider-request-context';
import {
  parseRuntimeSettings,
  ensureRuntimeSettingsSchema,
  saveRuntimeSettings,
} from '@/lib/server/agent-runtime/service-settings';
import { resolveAgentDriverModel } from '@/lib/server/agent-runtime/agent-driver-model';
import { resolveModel } from '@/lib/server/resolve-model';
import { resolveWebSearchCapability } from '@/lib/server/agent-runtime/web-search';
import {
  getServerImageProviders,
  getServerTTSProviders,
  resolveImageApiKey,
  resolveImageModel,
  resolveQwenVoiceCloneModel,
} from '@/lib/server/provider-config';
import { QWEN_TTS_VOICE_CLONE_MODEL } from '@/lib/audio/constants';
import type { ServiceSettingsSnapshot } from '@/lib/types/service-settings';

export const testSettings: ServiceSettingsSnapshot = {
  version: 1,
  role: 'teacher',
  llm: {
    providerId: 'deepseek',
    modelId: 'deepseek-v4-pro',
    apiKey: 'teacher-test-key',
    baseUrl: 'http://localhost:3004/v1',
    thinkingConfig: { mode: 'disabled' },
  },
};

afterEach(() => vi.unstubAllEnvs());

describe('existing settings centre drives native tools', () => {
  it('rejects absent settings and a different originating role', async () => {
    await expect(parseRuntimeSettings(undefined, 'teacher')).rejects.toThrow('设置');
    await expect(parseRuntimeSettings(testSettings, 'student')).rejects.toThrow('所属端');
  });

  it('uses the chosen model and thinking for both driver and page generation despite deployment routes', async () => {
    vi.stubEnv('DEFAULT_MODEL', 'openai:wrong-model');
    vi.stubEnv(
      'MODEL_ROUTES',
      JSON.stringify({
        'praxis-agent-driver': { model: 'openai:wrong-model', api: 'openai-completions' },
      }),
    );
    await withRuntimeServiceSettings(testSettings, async () => {
      const driver = await resolveAgentDriverModel();
      const content = await resolveModel({ stage: 'scene-content' });
      for (const actual of [driver.connection, content]) {
        expect(actual.modelString).toBe('deepseek:deepseek-v4-pro');
        expect(actual.apiKey).toBe('teacher-test-key');
        expect(actual.baseUrl).toBe('http://localhost:3004/v1');
        expect(actual.thinkingConfig).toEqual({ mode: 'disabled' });
      }
    });
  });

  it('keeps disabled services unavailable even with deployment keys and defaults', async () => {
    vi.stubEnv('WEB_SEARCH_TAVILY_API_KEY', 'deployment-search');
    vi.stubEnv('DEFAULT_IMAGE_PROVIDER', 'openai-image');
    vi.stubEnv('TTS_QWEN_VOICE_CLONE_MODEL', 'deployment-clone-model');
    await withRuntimeServiceSettings(testSettings, async () => {
      expect(resolveWebSearchCapability()).toBeNull();
      expect(getServerTTSProviders()).toEqual({});
      expect(getServerImageProviders()).toEqual({});
      expect(resolveImageApiKey('openai-image')).toBe('');
      expect(resolveQwenVoiceCloneModel()).toBe(QWEN_TTS_VOICE_CLONE_MODEL);
    });
  });

  it('preserves search options and recognition language through request parsing and runtime resolution', async () => {
    const snapshot = await parseRuntimeSettings(
      {
        ...testSettings,
        asr: { providerId: 'openai-whisper', apiKey: 'test', language: 'zh' },
        webSearch: {
          providerId: 'baidu',
          apiKey: 'test',
          baiduSubSources: { webSearch: false, baike: false, scholar: true },
        },
      },
      'teacher',
    );
    expect(snapshot.asr?.language).toBe('zh');
    withRuntimeServiceSettings(snapshot, () => {
      expect(resolveWebSearchCapability()?.baiduSubSources).toEqual({
        webSearch: false,
        baike: false,
        scholar: true,
      });
    });
    withRuntimeServiceSettings(
      {
        ...testSettings,
        webSearch: { providerId: 'claude', apiKey: 'test', modelId: 'chosen-search-model' },
      },
      () => {
        expect(resolveWebSearchCapability()?.claudeModelId).toBe('chosen-search-model');
      },
    );
  });

  it('isolates concurrent teacher and student credentials including media tools', async () => {
    const results = await Promise.all(
      ['teacher', 'student'].map((role) =>
        withRuntimeServiceSettings(
          {
            ...testSettings,
            role: role as 'teacher' | 'student',
            image: {
              providerId: 'openai-image',
              apiKey: `${role}-image-key`,
              modelId: `${role}-image-model`,
            },
          },
          async () => {
            await Promise.resolve();
            return [resolveImageApiKey('openai-image'), resolveImageModel('openai-image')];
          },
        ),
      ),
    );
    expect(results).toEqual([
      ['teacher-image-key', 'teacher-image-model'],
      ['student-image-key', 'student-image-model'],
    ]);
  });

  it('persists execution settings atomically but never exposes them as session metadata or events', async () => {
    const db = new PGlite();
    try {
      await ensureAgentSessionSchema(db);
      await ensureRuntimeSettingsSchema(db);
      const makeStore = () =>
        new PgAgentSessionStore(db, {
          withTransaction: (body) => db.transaction((tx) => body(tx as Queryable)),
          onSessionCreated: (tx, meta) =>
            saveRuntimeSettings(tx, meta.id, meta.ownerId, testSettings),
        });
      const first = await makeStore().createSession({
        id: 'settings-session',
        ownerId: 'teacher-owner',
        prompt: 'course',
      });
      await saveRuntimeSettings(db, first.id, 'wrong-owner', { ...testSettings, role: 'student' });
      const stored = await db.query<{ service_settings: ServiceSettingsSnapshot }>(
        'SELECT service_settings FROM agent_sessions WHERE id = $1',
        [first.id],
      );
      expect(stored.rows[0].service_settings).toEqual(testSettings);
      const afterWorkerRestart = await makeStore().getSession(first.id);
      expect(JSON.stringify(afterWorkerRestart)).not.toContain('teacher-test-key');
      expect(JSON.stringify(afterWorkerRestart)).not.toContain('service_settings');
      const events = await db.query('SELECT * FROM agent_session_events WHERE session_id = $1', [
        first.id,
      ]);
      expect(JSON.stringify(events.rows)).not.toContain('teacher-test-key');
    } finally {
      await db.close();
    }
  });
});
