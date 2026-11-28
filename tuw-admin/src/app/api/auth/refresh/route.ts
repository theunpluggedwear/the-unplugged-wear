import { limitAuthAttempt, clientIp } from '@/server/auth-rate-limit';
import { session } from '@/server/session';

export async function GET(request: Request) {
  await limitAuthAttempt('refresh', clientIp(request));
  return session.refreshRoute(request);
}
