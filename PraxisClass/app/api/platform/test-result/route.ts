import { z } from 'zod';

import { getPlatformDao } from '@/lib/platform/db/dao';
import { demoLearnerKey, requestRecordKind } from '@/lib/platform/record-context';

export const runtime = 'nodejs';

const testResultSchema = z.object({
  suite: z.string().min(1),
  case_id: z.string().min(1),
  learner_key: z.string().min(1),
  course_id: z.string().min(1).optional(),
  course_version: z.string().min(1).optional(),
  dimension: z.string().optional(),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  duration_ms: z.number().int().min(0).optional(),
  failure_reason: z.string().max(300).optional(),
  stage_id: z.string().min(1),
  attempt_id: z.string().optional(),
  record_kind: z.enum(['learning', 'demo']).optional(),
  scene_id: z.string().min(1).optional(),
  attempt_total: z.number().int().min(1).max(1000).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = testResultSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }

    const row = parsed.data;
    const recordKind = requestRecordKind(request, row.learner_key, row.record_kind);
    const learnerKey = recordKind === 'demo' ? demoLearnerKey(row.learner_key) : row.learner_key;
    const dao = await getPlatformDao();
    const label = dao.getCourseLabel(row.stage_id);
    const courseId = row.course_id ?? label?.course_id ?? row.stage_id;
    const courseVersion = row.course_version ?? label?.course_version ?? 'v1';
    // Length-delimited JSON fields also avoid ':' ambiguity in anonymous learner keys.
    const idempotencyKey = JSON.stringify([
      row.suite,
      row.stage_id,
      learnerKey,
      row.case_id,
      row.attempt_id ?? null,
      recordKind,
    ]);
    const result = dao.insertTestResult({
      suite: row.suite,
      case_id: row.case_id,
      learner_key: learnerKey,
      record_kind: recordKind,
      attempt_id: row.attempt_id ?? null,
      scene_id: row.scene_id ?? null,
      stage_id: row.stage_id,
      attempt_total: row.attempt_total ?? null,
      course_id: courseId,
      course_version: courseVersion,
      dimension: row.dimension ?? null,
      passed: row.passed,
      score: row.score,
      duration_ms: row.duration_ms ?? null,
      failure_reason: row.failure_reason ?? null,
      idempotency_key: idempotencyKey,
    });
    return Response.json(result, { status: 201 });
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}
