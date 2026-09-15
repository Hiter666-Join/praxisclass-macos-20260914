import { z } from 'zod';

import { requireTeacher } from '@/lib/platform/auth/require-teacher';
import { getPlatformDao } from '@/lib/platform/db/dao';
import { isCurrentScheduleEvent } from '@/lib/platform/schedule/reminder';
import { runScheduleTick } from '@/lib/platform/schedule/tick';

export const runtime = 'nodejs';

const sinceSchema = z.coerce.number().int();

export async function GET(request: Request): Promise<Response> {
  try {
    const unauthorized = await requireTeacher(request);
    if (unauthorized) return unauthorized;

    const rawSince = new URL(request.url).searchParams.get('since');
    const parsed = sinceSchema.safeParse(rawSince ?? Date.now() - 24 * 60 * 60_000);
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }

    const dao = await getPlatformDao();
    await runScheduleTick();
    const schedules = new Map(dao.listSchedule().map((item) => [item.id, item]));
    const events = dao
      .listScheduleEvents({ since: parsed.data })
      .flatMap((event) => {
        const schedule = schedules.get(event.schedule_id);
        if (!schedule || !isCurrentScheduleEvent(event, schedule)) return [];
        return [
          {
            id: event.id,
            scheduleId: schedule.id,
            title: schedule.title,
            location: schedule.location,
            classroomUrl: schedule.classroom_url,
            fireAt: event.fire_at,
            remindAt: event.fire_at - schedule.remind_before_min * 60_000,
            kind: event.kind,
          },
        ];
      }).slice(0, 50);
    return Response.json({ events });
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}
