import { CronExpressionParser } from 'cron-parser';

export type RRuleDescription =
  | { kind: 'weekly'; days: number[]; time: string }
  | { kind: 'cron'; expr: string }
  | { kind: 'invalid' };

const WEEKLY_PATTERN = /^weekly:([1-7](?:,[1-7])*)@(\d{2}):(\d{2})$/;

export function describeRRule(rrule: string): RRuleDescription {
  const weekly = WEEKLY_PATTERN.exec(rrule);
  if (weekly) {
    const hour = Number(weekly[2]);
    const minute = Number(weekly[3]);
    if (hour > 23 || minute > 59) return { kind: 'invalid' };
    return {
      kind: 'weekly',
      days: [...new Set(weekly[1].split(',').map(Number))],
      time: `${weekly[2]}:${weekly[3]}`,
    };
  }

  if (rrule.startsWith('cron:')) {
    const expr = rrule.slice(5).trim();
    if (!expr) return { kind: 'invalid' };
    try {
      CronExpressionParser.parse(expr);
      return { kind: 'cron', expr };
    } catch {
      return { kind: 'invalid' };
    }
  }

  return { kind: 'invalid' };
}

export function nextOccurrence(rrule: string, from: Date, startAt: number): Date | null {
  const fromMs = from.getTime();
  if (!Number.isFinite(fromMs)) return null;

  const description = describeRRule(rrule);
  if (description.kind === 'invalid') return null;

  const startsLater = startAt > fromMs;
  const lowerBound = startsLater ? startAt : fromMs;

  if (description.kind === 'weekly') {
    const [hour, minute] = description.time.split(':').map(Number);
    const base = new Date(lowerBound);
    if (!Number.isFinite(base.getTime())) return null;

    for (let offset = 0; offset <= 8; offset += 1) {
      const candidate = new Date(base);
      candidate.setDate(base.getDate() + offset);
      candidate.setHours(hour, minute, 0, 0);
      const weekday = candidate.getDay() === 0 ? 7 : candidate.getDay();
      const afterBoundary = startsLater
        ? candidate.getTime() >= lowerBound
        : candidate.getTime() > lowerBound;
      if (description.days.includes(weekday) && afterBoundary) return candidate;
    }
    return null;
  }

  try {
    const currentDate = new Date(startsLater ? lowerBound - 1 : lowerBound);
    return CronExpressionParser.parse(description.expr, { currentDate }).next().toDate();
  } catch {
    return null;
  }
}
