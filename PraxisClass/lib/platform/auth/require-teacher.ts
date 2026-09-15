import type { NextRequest } from 'next/server';

/** Passwordless Demo role selection; business services still enforce ownership and learner scope. */
export async function isTeacherRequest(req: Request | NextRequest): Promise<boolean> {
  return req.headers.get('x-praxis-role') !== 'student';
}

export async function requireTeacher(req: Request | NextRequest): Promise<Response | null> {
  if (await isTeacherRequest(req)) return null;
  return Response.json({ error: 'teacher_required' }, { status: 403 });
}
