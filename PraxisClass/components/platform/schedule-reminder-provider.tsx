'use client';
import type { ReactNode } from 'react';
import { useSettingsStore } from '@/lib/store/settings';
import { ScheduleReminderContext, useScheduleReminderController } from './use-schedule-events';

function ReminderSession({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const value = useScheduleReminderController(enabled);
  return (
    <ScheduleReminderContext.Provider value={value}>{children}</ScheduleReminderContext.Provider>
  );
}
export function ScheduleReminderProvider({ children }: { children: ReactNode }) {
  const mode = useSettingsStore((s) => s.mode);
  return <ReminderSession enabled={mode === 'teacher'}>{children}</ReminderSession>;
}
