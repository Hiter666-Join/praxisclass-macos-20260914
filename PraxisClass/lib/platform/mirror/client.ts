import { recordKindForLearner } from '@/lib/platform/record-context';

export interface MirrorTestResultInput {
  suite: string;
  caseId: string;
  stageId: string;
  learnerKey: string;
  attemptId?: string;
  sceneId?: string;
  attemptTotal?: number;
  passed: boolean;
  score: number;
  durationMs?: number;
  failureReason?: string;
  dimension?: string;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function post(input: MirrorTestResultInput): Promise<void> {
  const body = JSON.stringify({
    suite: input.suite,
    case_id: input.caseId,
    stage_id: input.stageId,
    learner_key: input.learnerKey,
    record_kind: recordKindForLearner(input.learnerKey),
    attempt_id: input.attemptId,
    scene_id: input.sceneId,
    attempt_total: input.attemptTotal ?? 1,
    passed: input.passed,
    score: input.score,
    duration_ms: input.durationMs,
    failure_reason: input.failureReason,
    dimension: input.dimension,
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch('/api/platform/test-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        signal: AbortSignal.timeout(8000),
      });
      if (response.status < 500) return;
    } catch {}
    if (attempt === 0) await wait(1500);
  }
}

export function mirrorTestResult(input: MirrorTestResultInput): void {
  if (typeof window === 'undefined') return;
  void post(input);
}

export function mirrorMany(inputs: MirrorTestResultInput[]): void {
  if (typeof window === 'undefined') return;
  void (async () => {
    for (const input of inputs) await post({ ...input, attemptTotal: inputs.length });
  })();
}
