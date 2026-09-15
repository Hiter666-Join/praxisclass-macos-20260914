import { z } from 'zod';
import type { MirrorTestResultInput } from './client';

const resultMessage = z.object({
  type: z.literal('praxis:code-test-results'),
  version: z.literal(1),
  suite: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  attemptId: z.string().min(1).max(128),
  results: z
    .array(
      z.object({
        caseId: z.string().min(1).max(128),
        passed: z.boolean(),
        durationMs: z.number().int().min(0).max(300_000).optional(),
        failureReason: z.string().max(300).optional(),
      }),
    )
    .min(1)
    .max(100),
});

/** Identity belongs to the host, never to generated/imported iframe content. */
export function parseInteractiveResults(
  data: unknown,
  context: { stageId: string; sceneId: string; learnerKey: string },
): MirrorTestResultInput[] {
  const parsed = resultMessage.safeParse(data);
  if (!parsed.success || !context.stageId || !context.sceneId || !context.learnerKey) return [];
  const message = parsed.data;
  if (new Set(message.results.map((row) => row.caseId)).size !== message.results.length) return [];
  return message.results.map((row) => ({
    suite: message.suite,
    caseId: row.caseId,
    stageId: context.stageId,
    sceneId: context.sceneId,
    learnerKey: context.learnerKey,
    attemptId: JSON.stringify([context.sceneId, message.attemptId]),
    passed: row.passed,
    score: row.passed ? 1 : 0,
    durationMs: row.durationMs,
    failureReason: row.passed ? undefined : (row.failureReason ?? 'wrong_answer'),
  }));
}
