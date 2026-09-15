import { apiSuccess } from '@/lib/server/api-response';

export async function POST() {
  return apiSuccess({ valid: true, mode: 'passwordless_demo' });
}
