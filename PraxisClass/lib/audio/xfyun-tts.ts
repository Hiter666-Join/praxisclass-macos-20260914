import { createHmac } from 'node:crypto';
import type { TTSModelConfig } from './types';
import {
  hasXfyunCredentials,
  splitXfyunCredentials,
  XFYUN_TTS_ENDPOINT,
  type XfyunCredentials,
} from './xfyun-config';

export class XfyunTTSError extends Error {
  readonly code = 'XFYUN_TTS_ERROR';

  constructor(
    message: string,
    public readonly httpStatus = 502,
  ) {
    super(message);
    this.name = 'XfyunTTSError';
  }
}

/** Official HMAC authentication. The signed URL must never be logged or returned to clients. */
export function signXfyunTTSUrl(credentials: XfyunCredentials, date = new Date()): string {
  const url = new URL(XFYUN_TTS_ENDPOINT);
  const timestamp = date.toUTCString();
  const signature = createHmac('sha256', credentials.apiSecret.trim())
    .update(`host: ${url.host}\ndate: ${timestamp}\nGET ${url.pathname} HTTP/1.1`)
    .digest('base64');
  const authorization = `api_key="${credentials.apiKey.trim()}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  url.searchParams.set('authorization', Buffer.from(authorization).toString('base64'));
  url.searchParams.set('date', timestamp);
  url.searchParams.set('host', url.host);
  return url.toString();
}

/** Online TTS v2: https://www.xfyun.cn/doc/tts/online_tts/API.html */
export async function generateXfyunTTS(
  config: TTSModelConfig,
  text: string,
  signal: AbortSignal,
): Promise<{ audio: Uint8Array; format: string }> {
  if (!hasXfyunCredentials(config.apiKey)) {
    throw new XfyunTTSError('讯飞 TTS 需要完整的 APPID、APIKey 和 APISecret。', 400);
  }
  if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text, 'utf8') >= 8000) {
    throw new XfyunTTSError(
      '讯飞 TTS 文本不能为空，且 UTF-8 长度须小于 8000 字节，请缩短文本。',
      400,
    );
  }
  if (config.format && config.format !== 'mp3') {
    throw new XfyunTTSError('讯飞在线 TTS 当前输出格式为 MP3。', 400);
  }
  // This adapter is for the official online TTS product. Never sign arbitrary hosts.
  if (
    config.baseUrl &&
    !['https://tts-api.xfyun.cn', 'https://tts-api.xfyun.cn/v2/tts', XFYUN_TTS_ENDPOINT].includes(
      config.baseUrl.replace(/\/$/, ''),
    )
  ) {
    throw new XfyunTTSError('讯飞在线 TTS 请使用官方接口 tts-api.xfyun.cn/v2/tts。', 400);
  }
  signal.throwIfAborted();
  const credentials = splitXfyunCredentials(config.apiKey);
  const speed = Number.isFinite(config.speed) ? config.speed! : 1;
  const payload = {
    common: { app_id: credentials.appId.trim() },
    business: {
      aue: 'lame',
      sfl: 1,
      auf: 'audio/L16;rate=16000',
      vcn: config.voice?.trim() || 'xiaoyan',
      tte: 'UTF8',
      // 1x is the vendor's neutral 50; adapt our 0.5–2 slider to its 0–100 scale.
      speed: Math.round(Math.max(0, Math.min(100, speed <= 1 ? (speed - 0.5) * 100 : speed * 50))),
    },
    data: { status: 2, text: Buffer.from(text, 'utf8').toString('base64') },
  };

  return new Promise((resolve, reject) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(signXfyunTTSUrl(credentials));
    } catch {
      reject(new XfyunTTSError('讯飞 TTS 连接创建失败，请检查服务端网络和 Node.js 版本。'));
      return;
    }
    const chunks: Uint8Array[] = [];
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      // Keep an inert error handler: closing while CONNECTING can emit a late error.
      socket.onerror = () => {};
      if (socket.readyState < WebSocket.CLOSING) socket.close(1000);
      if (error) reject(error);
      else resolve({ audio: new Uint8Array(Buffer.concat(chunks)), format: 'mp3' });
    };
    const onAbort = () => finish(signal.reason || new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    socket.onopen = () => {
      try {
        socket.send(JSON.stringify(payload));
      } catch {
        finish(new XfyunTTSError('讯飞 TTS 发送失败，请重试。'));
      }
    };
    socket.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        if (!frame || !Number.isInteger(frame.code)) throw new Error('Invalid response');
        if (frame.code !== 0) {
          const hints: Record<number, string> = {
            10005: '请检查 APPID 并开通在线语音合成服务。',
            10313: '请确认 APPID、APIKey 和 APISecret 来自同一应用。',
            11200: '请在讯飞控制台开通所选发音人，并检查授权有效期。',
            11201: '调用额度已用尽，请检查讯飞控制台的服务额度。',
            11202: '请求频率超限，请稍后重试。',
            11203: '并发数超限，请稍后重试。',
          };
          // Vendor payloads/events may contain credentials; report codes and safe hints only.
          finish(
            new XfyunTTSError(
              `讯飞 TTS 错误（${frame.code}）：${hints[frame.code] || '请在讯飞控制台检查服务配置。'}`,
              [11201, 11202, 11203].includes(frame.code) ? 429 : 502,
            ),
          );
          return;
        }
        // The vendor may send successful keepalive frames with data:null.
        if (!frame.data) return;
        if (frame.data.audio) {
          if (
            typeof frame.data.audio !== 'string' ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(frame.data.audio)
          ) {
            throw new Error('Invalid audio');
          }
          chunks.push(Buffer.from(frame.data.audio, 'base64'));
        }
        if (frame.data.status === 2) {
          finish(
            chunks.some((chunk) => chunk.length > 0)
              ? undefined
              : new XfyunTTSError('讯飞 TTS 未返回音频，请检查发音人授权。'),
          );
        }
      } catch {
        finish(new XfyunTTSError('讯飞 TTS 返回了无效的音频响应，请重试。'));
      }
    };
    socket.onerror = () =>
      finish(new XfyunTTSError('讯飞 TTS 连接或鉴权失败，请检查三项凭据、服务器时间和网络连接。'));
    socket.onclose = () => finish(new XfyunTTSError('讯飞 TTS 连接提前断开，音频未完成，请重试。'));
  });
}
