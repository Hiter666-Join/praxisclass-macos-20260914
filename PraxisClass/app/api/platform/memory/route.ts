import { z } from 'zod';
import { isDemoLearner } from '@/lib/platform/record-context';

import { requireTeacher } from '@/lib/platform/auth/require-teacher';
import { getPlatformDao } from '@/lib/platform/db/dao';
import { distillMemory } from '@/lib/platform/memory/distill';
import { clearMemory, readMemory, writeMemory } from '@/lib/platform/memory/store';
import type { MemoryScope } from '@/lib/platform/memory/types';

export const runtime = 'nodejs';

const LEARNER_KEY_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;

const charLimit = (limit: number) =>
  z
    .string()
    .refine((value) => [...value].length <= limit, { message: `Maximum ${limit} characters` });

const putSchema = z.object({
  profile: charLimit(2048).optional(),
  memory: charLimit(2048).optional(),
});

const eventSchema = z.object({
  eventType: z.enum([
    'struggle',
    'hint_used',
    'task_completed',
    'tier_change',
    'prep_created',
    'template_used',
  ]),
  summary: charLimit(200),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const postSchema = z.object({
  action: z.literal('distill'),
  sessionId: z.string().min(1).max(200),
  events: z.array(eventSchema).min(1).max(50),
});

function truncatePayloadJson(value: string): string {
  const result: string[] = [];
  let bytes = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, 'utf8');
    if (bytes + characterBytes > 4096) break;
    result.push(character);
    bytes += characterBytes;
  }
  return result.join('');
}

async function resolveSubject(
  request: Request,
): Promise<{ scope: MemoryScope; subjectId: string } | Response> {
  const scope = new URL(request.url).searchParams.get('scope');
  if (scope === 'teacher') {
    const unauthorized = await requireTeacher(request);
    return unauthorized ?? { scope, subjectId: 'teacher:main' };
  }
  if (scope === 'learner') {
    const value = request.headers.get('x-learner-key')?.trim();
    const subjectId = value && LEARNER_KEY_PATTERN.test(value) ? value : null;
    return subjectId
      ? { scope, subjectId }
      : Response.json({ error: 'learner_key_required' }, { status: 400 });
  }
  return Response.json({ error: 'invalid_scope' }, { status: 400 });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const subject = await resolveSubject(request);
    if (subject instanceof Response) return subject;
    return Response.json(await readMemory(subject.scope, subject.subjectId));
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const subject = await resolveSubject(request);
    if (subject instanceof Response) return subject;
    const parsed = putSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }
    return Response.json(await writeMemory(subject.scope, subject.subjectId, parsed.data));
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const subject = await resolveSubject(request);
    if (subject instanceof Response) return subject;
    if (
      subject.scope === 'learner' &&
      (isDemoLearner(subject.subjectId) || request.headers.get('x-praxis-role') === 'teacher')
    ) {
      return Response.json({ skipped: true, reason: 'demo_record' }, { status: 202 });
    }
    const parsed = postSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }
    const current = await readMemory(subject.scope, subject.subjectId);
    const memory = distillMemory(current.memory, parsed.data.events, new Date());
    const result = await writeMemory(subject.scope, subject.subjectId, { memory });
    const dao = await getPlatformDao();
    for (const event of parsed.data.events) {
      const payload = JSON.stringify({ summary: event.summary, payload: event.payload });
      dao.insertMemoryEvent({
        scope: subject.scope,
        subject_id: subject.subjectId,
        session_id: parsed.data.sessionId,
        event_type: event.eventType,
        payload_json: truncatePayloadJson(payload),
      });
    }
    return Response.json(result);
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const subject = await resolveSubject(request);
    if (subject instanceof Response) return subject;
    await clearMemory(subject.scope, subject.subjectId);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}
