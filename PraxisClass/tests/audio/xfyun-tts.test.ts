import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { generateTTS, TTSRequestTimeoutError } from '@/lib/audio/tts-providers';
import { signXfyunTTSUrl } from '@/lib/audio/xfyun-tts';
import { isTTSProviderEnabled } from '@/lib/audio/provider-enablement';
import { getEnabledProvidersWithVoices, resolveAgentVoice } from '@/lib/audio/voice-resolver';
import type { AgentConfig } from '@/lib/orchestration/registry/types';

class FakeSocket {
  static CLOSING = 2;
  static instances: FakeSocket[] = [];
  static frames: unknown[] = [];
  static earlyClose = false;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn(() => {
    this.readyState = 3;
  });
  send = vi.fn((_data: string) => {
    for (const frame of FakeSocket.frames) {
      this.onmessage?.({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) });
    }
    if (FakeSocket.earlyClose) this.onclose?.();
  });
  constructor(public url: string) {
    FakeSocket.instances.push(this);
    queueMicrotask(() => {
      if (this.readyState !== 0) return;
      this.readyState = 1;
      this.onopen?.();
    });
  }
}

const config = {
  providerId: 'xfyun-tts' as const,
  apiKey: 'app:test-key:test-secret',
  voice: 'xiaoyan',
};
const audioFrame = (status: number, bytes: number[]) => ({
  code: 0,
  data: { status, audio: Buffer.from(bytes).toString('base64') },
});

describe('iFLYTEK online TTS protocol', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    FakeSocket.frames = [audioFrame(1, [1, 2]), { code: 0, data: null }, audioFrame(2, [3, 4])];
    FakeSocket.earlyClose = false;
    vi.stubGlobal('WebSocket', FakeSocket);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('signs the exact official request line and RFC1123 date with HMAC-SHA256', () => {
    const date = new Date('2019-08-01T01:53:21Z');
    const url = new URL(
      signXfyunTTSUrl({ appId: 'app', apiKey: 'key', apiSecret: 'secret' }, date),
    );
    expect(url.origin + url.pathname).toBe('wss://tts-api.xfyun.cn/v2/tts');
    expect(url.searchParams.get('date')).toBe('Thu, 01 Aug 2019 01:53:21 GMT');
    const expected = createHmac('sha256', 'secret')
      .update('host: tts-api.xfyun.cn\ndate: Thu, 01 Aug 2019 01:53:21 GMT\nGET /v2/tts HTTP/1.1')
      .digest('base64');
    expect(Buffer.from(url.searchParams.get('authorization')!, 'base64').toString()).toBe(
      `api_key="key", algorithm="hmac-sha256", headers="host date request-line", signature="${expected}"`,
    );
    expect(url.toString()).not.toContain('secret');
  });

  it('dispatches from the common factory, sends UTF8 text and assembles all MP3 chunks', async () => {
    const result = await generateTTS({ ...config, voice: 'x4_xiaoyan', speed: 1 }, '你好，课堂。');
    expect(result).toEqual({ audio: new Uint8Array([1, 2, 3, 4]), format: 'mp3' });
    const socket = FakeSocket.instances[0];
    const payload = JSON.parse(socket.send.mock.calls[0][0]);
    expect(payload).toMatchObject({
      common: { app_id: 'app' },
      business: { vcn: 'x4_xiaoyan', aue: 'lame', sfl: 1, tte: 'UTF8', speed: 50 },
      data: { status: 2 },
    });
    expect(Buffer.from(payload.data.text, 'base64').toString('utf8')).toBe('你好，课堂。');
    expect(socket.close).toHaveBeenCalledWith(1000);
  });

  it.each(['app::secret', ':key:secret', 'app:key:', 'only-key', 'app:key:secret:extra'])(
    'rejects incomplete/malformed credentials without opening a socket: %s',
    async (apiKey) => {
      await expect(generateTTS({ ...config, apiKey }, 'hello')).rejects.toMatchObject({
        httpStatus: 400,
      });
      expect(FakeSocket.instances).toHaveLength(0);
    },
  );

  it('enforces the UTF8 byte limit, including Chinese and emoji text', async () => {
    await expect(generateTTS(config, '😀'.repeat(2000))).rejects.toMatchObject({ httpStatus: 400 });
    expect(FakeSocket.instances).toHaveLength(0);
    await expect(generateTTS(config, '中'.repeat(2666))).resolves.toHaveProperty('format', 'mp3');
  });

  it('never signs or connects to a supplied arbitrary endpoint', async () => {
    await expect(
      generateTTS({ ...config, baseUrl: 'https://example.com' }, 'hi'),
    ).rejects.toMatchObject({ httpStatus: 400 });
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it.each([11200, 11201, 11202, 11203])(
    'reports vendor code %s without exposing the payload',
    async (code) => {
      FakeSocket.frames = [{ code, message: 'test-secret in upstream diagnostics', data: null }];
      const error = await generateTTS(config, 'hi').catch((e) => e);
      expect(error.message).toContain(String(code));
      expect(error.message).not.toContain('test-secret');
      expect(error.httpStatus).toBe(code === 11200 ? 502 : 429);
      expect(FakeSocket.instances[0].close).toHaveBeenCalled();
    },
  );

  it.each(['invalid-json', JSON.stringify({ code: 0, data: { status: 2, audio: 'invalid%%' } })])(
    'rejects malformed responses',
    async (frame) => {
      FakeSocket.frames = [frame];
      await expect(generateTTS(config, 'hi')).rejects.toMatchObject({ httpStatus: 502 });
    },
  );

  it('rejects empty audio and partial audio closed before the final frame', async () => {
    FakeSocket.frames = [audioFrame(2, [])];
    await expect(generateTTS(config, 'hi')).rejects.toThrow('未返回音频');
    FakeSocket.frames = [audioFrame(1, [1])];
    FakeSocket.earlyClose = true;
    await expect(generateTTS(config, 'hi')).rejects.toThrow('提前断开');
  });

  it('closes an in-flight socket on cancel and opens none for a pre-aborted signal', async () => {
    FakeSocket.frames = [];
    const controller = new AbortController();
    const request = generateTTS({ ...config, signal: controller.signal }, 'hi');
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeSocket.instances[0].close).toHaveBeenCalled();
    await expect(generateTTS({ ...config, signal: controller.signal }, 'hi')).rejects.toMatchObject(
      { name: 'AbortError' },
    );
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('uses the common request timeout and closes a hung socket', async () => {
    FakeSocket.frames = [];
    vi.stubEnv('TTS_REQUEST_TIMEOUT_MS', '30');
    await expect(generateTTS(config, 'hi')).rejects.toBeInstanceOf(TTSRequestTimeoutError);
    expect(FakeSocket.instances[0].close).toHaveBeenCalled();
  });

  it('requires all credentials before offering preset and user-added voices in class', () => {
    expect(isTTSProviderEnabled('xfyun-tts', { apiKey: 'app:key:' })).toBe(false);
    const providers = getEnabledProvidersWithVoices({
      'xfyun-tts': {
        apiKey: config.apiKey,
        customVoices: [{ id: 'x4_xiaoyan', name: 'My licensed voice' }],
      },
    });
    expect(providers[0].voices.map((v) => v.id)).toEqual(['xiaoyan', 'x4_xiaoyan']);
    expect(
      resolveAgentVoice(
        {
          id: 'teacher',
          voiceConfig: { providerId: 'xfyun-tts', voiceId: 'x4_xiaoyan' },
        } as AgentConfig,
        0,
        providers,
      ),
    ).toMatchObject({ providerId: 'xfyun-tts', voiceId: 'x4_xiaoyan' });
  });
});
