import { clearTeacherCookieHeader } from '@/lib/platform/auth/teacher-gate';

export const runtime = 'nodejs';

/** Compatibility status for older clients. No PIN or teacher cookie is needed. */
export async function GET(): Promise<Response> {
  return Response.json({ enabled: false, authenticated: true, mode: 'passwordless_demo' });
}

export async function POST(): Promise<Response> {
  return Response.json({ ok: true, enabled: false, mode: 'passwordless_demo' });
}

export async function DELETE(): Promise<Response> {
  const response = Response.json({ ok: true });
  response.headers.set('Set-Cookie', clearTeacherCookieHeader());
  return response;
}
