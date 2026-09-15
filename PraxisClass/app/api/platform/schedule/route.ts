import { z } from 'zod';

import { requireTeacher } from '@/lib/platform/auth/require-teacher';
import { getPlatformDao } from '@/lib/platform/db/dao';
import type { ScheduleRow } from '@/lib/platform/db/types';
import { describeRRule } from '@/lib/platform/schedule/next-occurrence';

export const runtime = 'nodejs';

/** The DB stores `enabled` as 0 | 1; the API contract exposes a boolean. */
function toApiSchedule(row: ScheduleRow): Omit<ScheduleRow, 'enabled'> & { enabled: boolean } {
  return { ...row, enabled: Boolean(row.enabled) };
}

const scheduleSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  location: z.string().optional(),
  rrule: z.string().min(1),
  start_at: z.number().int(),
  duration_min: z.number().int().min(1).default(45),
  classroom_url: z
    .string()
    .refine((value) => value.startsWith('/') || value.startsWith('http'))
    .optional(),
  remind_before_min: z.number().int().min(0).default(10),
  enabled: z.boolean().optional(),
});

const schedulePatchSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  title: z.string().min(1).optional(),
  location: z.string().optional(),
  rrule: z.string().min(1).optional(),
  start_at: z.number().int().optional(),
  duration_min: z.number().int().min(1).optional(),
  classroom_url: z
    .string()
    .refine((value) => value.startsWith('/') || value.startsWith('http'))
    .optional(),
  remind_before_min: z.number().int().min(0).optional(),
});

export async function GET(): Promise<Response> {
  try {
    const dao = await getPlatformDao();
    return Response.json({ items: dao.listSchedule().map(toApiSchedule) });
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const unauthorized = await requireTeacher(request);
    if (unauthorized) return unauthorized;
    const parsed = scheduleSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }
    if (describeRRule(parsed.data.rrule).kind === 'invalid') {
      return Response.json({ error: 'invalid_rrule' }, { status: 400 });
    }

    const dao = await getPlatformDao();
    return Response.json({ item: toApiSchedule(dao.upsertSchedule(parsed.data)) });
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const unauthorized = await requireTeacher(request);
    if (unauthorized) return unauthorized;
    const parsed = schedulePatchSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }
    if (parsed.data.rrule && describeRRule(parsed.data.rrule).kind === 'invalid') {
      return Response.json({ error: 'invalid_rrule' }, { status: 400 });
    }

    const dao = await getPlatformDao();
    const existing = dao.listSchedule().find((item) => item.id === parsed.data.id);
    if (!existing) return Response.json({ error: 'not_found' }, { status: 404 });

    const item = dao.upsertSchedule({
      id: existing.id,
      title: parsed.data.title ?? existing.title,
      location: parsed.data.location ?? existing.location,
      rrule: parsed.data.rrule ?? existing.rrule,
      start_at: parsed.data.start_at ?? existing.start_at,
      duration_min: parsed.data.duration_min ?? existing.duration_min,
      classroom_url: parsed.data.classroom_url ?? existing.classroom_url,
      remind_before_min: parsed.data.remind_before_min ?? existing.remind_before_min,
      enabled: parsed.data.enabled ?? existing.enabled,
    });
    return Response.json({ item: toApiSchedule(item) });
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const unauthorized = await requireTeacher(request);
    if (unauthorized) return unauthorized;
    const parsed = z.string().min(1).safeParse(new URL(request.url).searchParams.get('id'));
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }

    const dao = await getPlatformDao();
    dao.deleteSchedule(parsed.data);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}
