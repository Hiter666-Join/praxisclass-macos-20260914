import { getPlatformDao } from '@/lib/platform/db/dao';
import { dueScheduleOccurrences } from '@/lib/platform/schedule/reminder';
import { backupPlatformData } from '@/lib/platform/db/backup';

export interface ScheduleTickHandle {
  stop(): void;
}

const SCHEDULE_TICK_KEY = Symbol.for('openmaic.platform.schedule-tick');
const globalState = globalThis as typeof globalThis & {
  [key: symbol]: ScheduleTickHandle | undefined;
};

export async function runScheduleTick(
  now = new Date(),
): Promise<{ checked: number; inserted: number }> {
  const dao = await getPlatformDao();
  const schedules = dao.listSchedule({ enabledOnly: true });
  let inserted = 0;
  let warned = false;

  for (const schedule of schedules) {
    try {
      for (const fireAt of dueScheduleOccurrences(schedule, now.getTime())) {
        if (dao.hasScheduleEvent(schedule.id, fireAt, schedule.updated_at)) continue;
        dao.insertScheduleEvent({ schedule_id: schedule.id, fire_at: fireAt, kind: 'upcoming',
          created_at: now.getTime(), payload_json: JSON.stringify({ scheduleUpdatedAt: schedule.updated_at,
            remindAt: fireAt - schedule.remind_before_min * 60_000 }) });
        inserted += 1;
      }
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn('[platform-schedule] Failed to process a schedule row', error);
      }
    }
  }

  return { checked: schedules.length, inserted };
}

export function startScheduleTick(): ScheduleTickHandle {
  const existing = globalState[SCHEDULE_TICK_KEY];
  if (existing) return existing;

  let running = false;
  let lastBackupCheck = 0;
  const trigger = (): void => {
    if (running) return;
    running = true;
    void runScheduleTick()
      .then(async () => {
        // Retry a failed daily snapshot at most hourly, without delaying server startup.
        if (Date.now() - lastBackupCheck < 3_600_000) return;
        lastBackupCheck = Date.now();
        await backupPlatformData();
      })
      .catch((error) => console.warn('[platform-schedule] Tick failed', error))
      .finally(() => {
        running = false;
      });
  };
  const timer = setInterval(trigger, Number(process.env.PLATFORM_SCHEDULE_TICK_MS) || 10_000);
  timer.unref?.();

  const handle: ScheduleTickHandle = {
    stop: () => {
      clearInterval(timer);
      globalState[SCHEDULE_TICK_KEY] = undefined;
    },
  };
  globalState[SCHEDULE_TICK_KEY] = handle;
  trigger();
  return handle;
}
