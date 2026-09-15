import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { isTeacherRequest, requireTeacher } from '@/lib/platform/auth/require-teacher';
import { GET as teacherStatus, POST as enterTeacher } from '@/app/api/platform/teacher-pin/route';
import { GET as accessStatus } from '@/app/api/access-code/status/route';
import { POST as enterSite } from '@/app/api/access-code/verify/route';

describe('passwordless Demo entry', () => {
  beforeEach(() => {
    vi.stubEnv('TEACHER_PIN', 'obsolete-config-ignored');
    vi.stubEnv('ACCESS_CODE', 'obsolete-config-ignored');
  });
  afterEach(() => vi.unstubAllEnvs());
  it('allows both role pages and their API traffic without password cookies', async () => {
    for (const path of ['/teacher', '/teacher/courses', '/student', '/dashboard', '/api/platform/dashboard?scope=all', '/api/stages']) {
      const response = await middleware(new NextRequest(`http://localhost${path}`));
      expect(response.headers.get('x-middleware-next')).toBe('1');
      expect(response.headers.get('location')).toBeNull();
    }
  });
  it('reports passwordless status and accepts an empty compatibility entry request', async () => {
    expect(await (await teacherStatus()).json()).toMatchObject({ enabled: false, authenticated: true });
    expect(await (await enterTeacher()).json()).toMatchObject({ ok: true, enabled: false });
    expect(await (await accessStatus()).json()).toMatchObject({ enabled: false, authenticated: true });
    expect(await (await enterSite()).json()).toMatchObject({ valid: true });
  });
  it('removes old key parameters without requiring or issuing a teacher cookie', async () => {
    const response = await middleware(new NextRequest('http://localhost/portal?key=obsolete'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://localhost/teacher');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
  it('retains the explicit student role boundary on teacher business operations', async () => {
    const student = new Request('http://localhost/api/platform/memory?scope=teacher', { headers: { 'x-praxis-role': 'student' } });
    expect(await isTeacherRequest(student)).toBe(false);
    expect((await requireTeacher(student))?.status).toBe(403);
    expect(await requireTeacher(new Request('http://localhost/teacher'))).toBeNull();
  });
});
