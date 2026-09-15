export const SCHEDULE_CHANGED = 'praxis:schedule-changed';
export const SCHEDULE_CHANGE_KEY = 'praxis.schedule.revision';
export function notifyScheduleChanged(): void {
  window.dispatchEvent(new Event(SCHEDULE_CHANGED));
  try { localStorage.setItem(SCHEDULE_CHANGE_KEY, `${Date.now()}:${Math.random()}`); } catch { /* same-tab event still works */ }
}
export function subscribeScheduleChanges(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => { if (event.key === SCHEDULE_CHANGE_KEY) listener(); };
  window.addEventListener(SCHEDULE_CHANGED, listener);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(SCHEDULE_CHANGED, listener); window.removeEventListener('storage', onStorage); };
}
