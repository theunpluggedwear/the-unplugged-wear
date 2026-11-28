import 'server-only';
import { hitRateLimit, type Limit } from '@tuw/heart/platform/ratelimit';

export async function limitAuthAttempt(bucket: string, ip: string | null | undefined, email?: string | null | undefined): Promise<void> {
  const limits: Limit[] = [];
  if (ip) limits.push({ key: ip, max: 10, windowSeconds: 1 });
  if (email) limits.push({ key: email.trim().toLowerCase(), max: 5, windowSeconds: 60 });
  await hitRateLimit(`auth.${bucket}`, limits);
}

export function clientIp(request: Request): string | null {
  const forwarded = (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip');
  return ip && /^[0-9a-fA-F.:]{3,45}$/.test(ip) ? ip : null;
}
