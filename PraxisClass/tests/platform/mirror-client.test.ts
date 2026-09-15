import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mirrorTestResult } from '@/lib/platform/mirror/client';

const input = {
  suite: 'quiz_stage-1',
  caseId: 'question-1',
  stageId: 'stage-1',
  learnerKey: 'anon:learner-1',
  passed: true,
  score: 1,
};

describe('mirrorTestResult', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('posts once on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    mirrorTestResult(input);
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/test-result',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    );
  });

  it('retries one network failure and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    mirrorTestResult(input);
    await vi.advanceTimersByTimeAsync(1500);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after one retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    mirrorTestResult(input);
    await vi.advanceTimersByTimeAsync(1500);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
