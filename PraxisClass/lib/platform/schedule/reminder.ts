import type { ScheduleEventRow, ScheduleRow } from '@/lib/platform/db/types';
import { nextOccurrence } from './next-occurrence';

export const REMINDER_CATCHUP_MS = 2 * 60_000;

/** Class starts whose reminder time falls in the current delivery window. */
export function dueScheduleOccurrences(schedule: ScheduleRow, now: number): number[] {
  const advance = schedule.remind_before_min * 60_000;
  const due: number[] = [];
  let cursor = now - REMINDER_CATCHUP_MS - 1;
  for (let count = 0; count < 256; count += 1) {
    const next = nextOccurrence(schedule.rrule, new Date(cursor), schedule.start_at)?.getTime();
    if (next === undefined || next > now + advance) break;
    if (next >= now - REMINDER_CATCHUP_MS) due.push(next);
    cursor = next;
  }
  return due;
}

export function isCurrentScheduleEvent(event: ScheduleEventRow, schedule: ScheduleRow): boolean {
  if (!schedule.enabled) return false;
  try {
    const payload = JSON.parse(event.payload_json || '{}') as { scheduleUpdatedAt?: number };
    if (payload.scheduleUpdatedAt !== undefined) return payload.scheduleUpdatedAt === schedule.updated_at;
  } catch { return false; }
  return event.created_at >= schedule.updated_at &&
    nextOccurrence(schedule.rrule, new Date(event.fire_at - 1), schedule.start_at)?.getTime() === event.fire_at;
}
