import { z } from 'zod';

import { buildDashboardPayload } from '@/lib/platform/analytics/aggregate';
import { readLearnerKey } from '@/lib/platform/api/learner-key';
import { requireTeacher } from '@/lib/platform/auth/require-teacher';
import { getPlatformDao } from '@/lib/platform/db/dao';
import { buildStudentLearning } from '@/lib/platform/analytics/student-learning';

export const runtime = 'nodejs';

const scopeSchema = z.enum(['all', 'self']).default('all');

export async function GET(request: Request): Promise<Response> {
  try {
    const parsed = scopeSchema.safeParse(
      new URL(request.url).searchParams.get('scope') ?? undefined,
    );
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }

    const scope = parsed.data;
    const kind = z
      .enum(['learning', 'demo', 'legacy'])
      .safeParse(new URL(request.url).searchParams.get('recordKind') ?? 'learning');
    if (!kind.success) return Response.json({ error: 'invalid_record_kind' }, { status: 400 });
    let learnerKey: string | null = null;
    if (scope === 'self') {
      learnerKey = readLearnerKey(request);
      if (!learnerKey) {
        return Response.json({ error: 'learner_key_required' }, { status: 400 });
      }
    } else {
      const unauthorized = await requireTeacher(request);
      if (unauthorized) return unauthorized;
    }

    const dao = await getPlatformDao();
    const results = dao.listTestResults(learnerKey ? { learnerKey } : undefined);
    const selected = results.filter((row) => (row.record_kind ?? 'legacy') === kind.data);
    const feedback = dao.listFeedback({
      ...(learnerKey ? { subjectId: learnerKey } : {}),
      recordKind: kind.data,
    });
    return Response.json({
      ...buildDashboardPayload({
        scope,
        testResults: selected,
        feedback,
        knowledge: dao.countKnowledge(),
        courseLabels: dao.listCourseLabels().length,
        courseCatalog: dao.listCourseLabels(),
      }),
      recordKind: kind.data,
      recordCounts: Object.fromEntries(
        ['learning', 'demo', 'legacy'].map((key) => [
          key,
          results.filter((row) => (row.record_kind ?? 'legacy') === key).length,
        ]),
      ),
      learning: buildStudentLearning(results),
      feedbackEntries: feedback.slice(0, 100),
    });
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}
