import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getPlatformDao, resetPlatformDaoForTests } from '@/lib/platform/db/dao';
import {
  describeRRule,
  nextOccurrence,
} from '@/lib/platform/schedule/next-occurrence';
import { runScheduleTick } from '@/lib/platform/schedule/tick';
import { isCurrentScheduleEvent } from '@/lib/platform/schedule/reminder';

let testDirectory = '';

beforeEach(() => {
  resetPlatformDaoForTests();
  testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-schedule-jsonl-'));
  process.env.PLATFORM_DATA_DIR = testDirectory;
  process.env.PLATFORM_DB_DRIVER = 'jsonl';
});

afterEach(() => {
  resetPlatformDaoForTests();
  fs.rmSync(testDirectory, { recursive: true, force: true });
  delete process.env.PLATFORM_DATA_DIR;
  delete process.env.PLATFORM_DB_DRIVER;
});

describe('schedule next occurrence', () => {
  it.each(['weekly:2@08:00', 'cron:0 8 * * 2'])('fires zero-minute reminders and catches a delayed tick: %s', async rrule => {
    const dao = await getPlatformDao();
    const at = new Date(2024, 0, 2, 8).getTime();
    dao.upsertSchedule({ id: 'zero', title: 'Zero', rrule, start_at: at, remind_before_min: 0 });
    expect((await runScheduleTick(new Date(at - 1))).inserted).toBe(0);
    expect((await runScheduleTick(new Date(at))).inserted).toBe(1);
    expect((await runScheduleTick(new Date(at + 1000))).inserted).toBe(0);
    dao.upsertSchedule({ id: 'late', title: 'Late', rrule, start_at: at, remind_before_min: 1 });
    expect((await runScheduleTick(new Date(at + 1000))).inserted).toBe(1);
  });
  it('invalidates edited or disabled reminders while preserving history', async () => {
    const dao = await getPlatformDao();
    const at = new Date(2024, 0, 2, 8).getTime();
    const input = { id: 'changing', title: 'Original', rrule: 'weekly:2@08:00', start_at: at, remind_before_min: 10 };
    const original = dao.upsertSchedule(input);
    await runScheduleTick(new Date(at - 600_000));
    const event = dao.listScheduleEvents()[0];
    expect(isCurrentScheduleEvent(event, original)).toBe(true);
    const changed = dao.upsertSchedule({ ...input, title: 'Revised' });
    expect(isCurrentScheduleEvent(event, changed)).toBe(false);
    expect((await runScheduleTick(new Date(at - 600_000))).inserted).toBe(1);
    const disabled = dao.upsertSchedule({ ...input, enabled: false });
    expect(dao.listScheduleEvents().every(item => !isCurrentScheduleEvent(item, disabled))).toBe(true);
    dao.deleteSchedule(input.id);
    expect(dao.listSchedule()).toHaveLength(0);
    expect(dao.listScheduleEvents()).toHaveLength(2);
  });
  it('resolves the next weekly weekday', () => {
    const tuesday = new Date(2024, 0, 2, 9, 0);
    expect(nextOccurrence('weekly:1,3,5@08:00', tuesday, 0)).toEqual(
      new Date(2024, 0, 3, 8, 0),
    );
  });

  it('wraps a weekly schedule to Monday', () => {
    const friday = new Date(2024, 0, 5, 9, 0);
    expect(nextOccurrence('weekly:1,3,5@08:00', friday, 0)).toEqual(
      new Date(2024, 0, 8, 8, 0),
    );
  });

  it('rejects malformed rules', () => {
    expect(nextOccurrence('weekly:8@08:00', new Date(2024, 0, 2), 0)).toBeNull();
  });

  it('resolves a weekday cron from Saturday', () => {
    const saturday = new Date(2024, 0, 6, 9, 0);
    expect(nextOccurrence('cron:0 8 * * 1-5', saturday, 0)).toEqual(
      new Date(2024, 0, 8, 8, 0),
    );
  });

  it('describes weekly, cron, and invalid rules', () => {
    expect(describeRRule('weekly:1,3,5@08:00')).toEqual({
      kind: 'weekly',
      days: [1, 3, 5],
      time: '08:00',
    });
    expect(describeRRule('cron:0 8 * * 1-5')).toEqual({
      kind: 'cron',
      expr: '0 8 * * 1-5',
    });
    expect(describeRRule('daily')).toEqual({ kind: 'invalid' });
  });

  it('inserts one reminder event and deduplicates the next tick', async () => {
    const now = new Date(2024, 0, 2, 7, 55, 0, 0);
    const fireAt = new Date(2024, 0, 2, 8, 0, 0, 0).getTime();
    const dao = await getPlatformDao();
    dao.upsertSchedule({
      id: 'schedule-1',
      title: 'Algorithms',
      rrule: 'weekly:2@08:00',
      start_at: fireAt,
      remind_before_min: 10,
    });

    await expect(runScheduleTick(now)).resolves.toEqual({ checked: 1, inserted: 1 });
    await expect(runScheduleTick(now)).resolves.toEqual({ checked: 1, inserted: 0 });
    expect(dao.listScheduleEvents({ since: now.getTime() })).toHaveLength(1);
  });
});
