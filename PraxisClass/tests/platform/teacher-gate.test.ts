import { afterEach, describe, expect, it } from 'vitest';

import {
  TEACHER_COOKIE_NAME,
  clearTeacherCookieHeader,
  isTeacherGateEnabled,
} from '@/lib/platform/auth/teacher-gate';
import { isTeacherRequest } from '@/lib/platform/auth/require-teacher';

const originalPin = process.env.TEACHER_PIN;

afterEach(() => {
  if (originalPin === undefined) delete process.env.TEACHER_PIN;
  else process.env.TEACHER_PIN = originalPin;
});

describe('teacher gate', () => {
  it('keeps Demo entry passwordless even if an old environment contains a pin', async () => {
    delete process.env.TEACHER_PIN;
    expect(isTeacherGateEnabled()).toBe(false);
    await expect(isTeacherRequest(new Request('http://localhost/teacher'))).resolves.toBe(true);
    process.env.TEACHER_PIN = '   ';
    expect(isTeacherGateEnabled()).toBe(false);
    await expect(isTeacherRequest(new Request('http://localhost/teacher'))).resolves.toBe(true);
    process.env.TEACHER_PIN = '123456';
    expect(isTeacherGateEnabled()).toBe(false);
  });

  it('clears obsolete teacher cookies for older browsers', () => {
    const cleared = clearTeacherCookieHeader();
    expect(cleared).toContain(`${TEACHER_COOKIE_NAME}=;`);
    expect(cleared).toContain('HttpOnly');
    expect(cleared).toContain('SameSite=Lax');
    expect(cleared).toContain('Path=/');
    expect(cleared).toContain('Max-Age=0');
  });
});
