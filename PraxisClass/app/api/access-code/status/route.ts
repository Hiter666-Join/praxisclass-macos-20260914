import { apiSuccess } from '@/lib/server/api-response';

export async function GET() {
  return apiSuccess({ enabled: false, authenticated: true, mode: 'passwordless_demo' });
}
