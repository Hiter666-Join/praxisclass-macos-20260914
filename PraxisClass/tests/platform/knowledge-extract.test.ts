import type { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/platform/knowledge/route';
import { callLLM } from '@/lib/ai/llm';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { difyRetrieve } from '@/lib/platform/knowledge/dify';

vi.mock('@/lib/platform/auth/require-teacher', () => ({
  requireTeacher: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/platform/knowledge/dify', () => ({
  resolveDifyCredentials: vi
    .fn()
    .mockReturnValue({ baseUrl: 'https://dify.test', datasetId: 'test', apiKey: 'test' }),
  difyRetrieve: vi.fn().mockResolvedValue([
    {
      title: '程序入门.pdf',
      content: '整数运算可以精确计算。',
      source: '程序入门.pdf',
      stage: '',
      score: 0.9,
    },
    {
      title: '程序入门.pdf',
      content: '浮点数运算可能产生舍入误差。',
      source: '程序入门.pdf',
      stage: '',
      score: 0.8,
    },
  ]),
}));
vi.mock('@/lib/ai/llm', () => ({ callLLM: vi.fn() }));
vi.mock('@/lib/server/resolve-model', () => ({ resolveModelFromRequest: vi.fn() }));

const request = () =>
  new Request('http://localhost/api/platform/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'extract', text: '解释整数和浮点数计算。' }),
  }) as NextRequest;

afterEach(() => vi.clearAllMocks());

describe('knowledge evidence handoff', () => {
  it('does not call the model when Dify returns no evidence', async () => {
    vi.mocked(difyRetrieve).mockResolvedValueOnce([]);
    const response = await POST(request());
    expect(await response.json()).toEqual({ source: 'dify', points: [], llm: false });
    expect(resolveModelFromRequest).not.toHaveBeenCalled();
    expect(callLLM).not.toHaveBeenCalled();
  });
  it('retains retrieved text and sources when no generation model is configured', async () => {
    vi.mocked(resolveModelFromRequest).mockRejectedValueOnce(new Error('no_model'));
    const response = await POST(request());
    expect(await response.json()).toMatchObject({
      source: 'dify',
      llm: false,
      points: [
        { source: '程序入门.pdf', content: '整数运算可以精确计算。' },
        { source: '程序入门.pdf', content: '浮点数运算可能产生舍入误差。' },
      ],
    });
  });

  it('binds generated points to the exact selected chunk and rejects fabricated references', async () => {
    vi.mocked(resolveModelFromRequest).mockResolvedValueOnce({} as never);
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify([
        { name: '浮点误差', stage: '讲解', itemIndex: 1, source: '伪造来源', content: '伪造原文' },
        { name: '没有依据', stage: '讲解', itemIndex: 20 },
      ]),
    } as never);
    const response = await POST(request());
    expect(await response.json()).toEqual({
      source: 'dify',
      llm: true,
      points: [
        {
          name: '浮点误差',
          stage: '讲解',
          source: '程序入门.pdf',
          content: '浮点数运算可能产生舍入误差。',
        },
      ],
    });
  });
});
