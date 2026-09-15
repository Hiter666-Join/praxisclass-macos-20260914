import { z } from 'zod';

import { getPlatformDao } from '@/lib/platform/db/dao';
import { demoLearnerKey, requestRecordKind } from '@/lib/platform/record-context';

export const runtime = 'nodejs';

const feedbackSchema = z.object({
  form_type: z.enum(['learner_session', 'teacher_prep', 'teacher_post_class']),
  subject_id: z.string().min(1).max(128),
  course_id: z.string().min(1).max(128),
  course_version: z.string().min(1).max(32).optional(),
  stage_id: z.string().min(1).max(128).optional(),
  title: z.string().min(1).max(200).optional(),
  ratings: z.record(z.string(), z.number().int().min(1).max(5)),
  text: z.record(z.string(), z.union([z.string().max(300), z.array(z.string())])),
  idempotency_key: z.string().max(200).optional(),
  record_kind: z.enum(['learning', 'demo']).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = feedbackSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }

    // Open by design so anonymous learner feedback can be recorded without teacher credentials.
    const dao = await getPlatformDao();
    const row = parsed.data;
    const recordKind =
      row.form_type === 'learner_session'
        ? requestRecordKind(request, row.subject_id, row.record_kind)
        : (row.record_kind ?? 'legacy');
    const subjectId =
      row.form_type === 'learner_session' && recordKind === 'demo'
        ? demoLearnerKey(row.subject_id)
        : row.subject_id;
    const label =
      row.form_type === 'teacher_prep'
        ? undefined
        : dao.getCourseLabel(row.stage_id ?? row.course_id);
    const courseId = label?.course_id ?? row.course_id;
    const courseVersion = row.course_version ?? label?.course_version ?? 'v1';
    const result = dao.insertFeedback({
      form_type: parsed.data.form_type,
      subject_id: subjectId,
      record_kind: recordKind,
      course_id: courseId,
      course_version: courseVersion,
      ratings_json: JSON.stringify(parsed.data.ratings),
      text_json: JSON.stringify(parsed.data.text),
      idempotency_key: row.idempotency_key
        ? JSON.stringify([row.idempotency_key, recordKind, subjectId, courseVersion])
        : undefined,
    });
    if (parsed.data.form_type === 'teacher_prep' && parsed.data.stage_id) {
      dao.upsertCourseLabel({
        stage_id: parsed.data.stage_id,
        course_id: parsed.data.course_id,
        course_version: courseVersion,
        title: parsed.data.title,
      });
    }
    return Response.json(result, { status: 201 });
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}
