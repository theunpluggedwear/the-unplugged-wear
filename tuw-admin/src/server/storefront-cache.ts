import 'server-only';






export type StorefrontRefresh = { ok: true } | { ok: false; reason: string };

export async function refreshStorefront(tags: string[]): Promise<StorefrontRefresh> {
  const base = process.env.STOREFRONT_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!base || !secret) return { ok: false, reason: 'Storefront refresh is not configured (STOREFRONT_URL / REVALIDATE_SECRET).' };
  try {
    const res = await fetch(new URL('/api/revalidate', base), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    return res.ok ? { ok: true } : { ok: false, reason: `Storefront answered ${res.status}.` };
  } catch (error) {
    console.warn('[storefront-cache] refresh failed', (error as Error).message);
    return { ok: false, reason: 'The storefront could not be reached.' };
  }
}
