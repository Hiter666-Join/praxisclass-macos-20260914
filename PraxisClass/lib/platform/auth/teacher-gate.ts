export const TEACHER_COOKIE_NAME = 'praxis_teacher';

export function isTeacherGateEnabled(): boolean {
  // Enterprise teachers requested passwordless Demo entry on 2026-09-14.
  // Ignore legacy environment PINs so an older launch script cannot re-enable the gate.
  return false;
}

export function clearTeacherCookieHeader(): string {
  return `${TEACHER_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
