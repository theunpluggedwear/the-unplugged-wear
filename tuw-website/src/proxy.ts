import { NextResponse, type NextRequest } from 'next/server';
import { createAuthProxy } from '@tuw/heart/next/proxy';
import { COOKIE_NAMES, verifyAccessToken } from '@tuw/heart/modules/auth/tokens';

// Optimistic gate only (auth-guards skill): account pages need a session.
// Every action and data read re-checks through the guards / DAL.
const authGate = createAuthProxy({
  app: 'storefront',
  // Checkout needs a session; /checkout/success stays public so receipt links
  // still work. Every action re-checks through guards / the DAL.
  isProtected: (pathname) =>
    pathname === '/account' ||
    pathname.startsWith('/account/') ||
    pathname === '/checkout' ||
    (pathname.startsWith('/checkout/') && pathname !== '/checkout/success') ||
    pathname === '/demo-invoice' ||
    pathname.startsWith('/demo-invoice/'),
});

/** Pages only for signed-out visitors; a signed-in shopper is sent on. */
const GUEST_ONLY = new Set(['/login', '/register']);

/** Same rule as safeNext in @tuw/heart: same-site paths only, never back to a guest-only page. */
function returnPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/account';
  const path = raw.split(/[?#]/, 1)[0];
  return GUEST_ONLY.has(path) ? '/account' : raw;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  if (GUEST_ONLY.has(pathname)) {
    // A live session skips the form. An expired one still sees it, so the
    // shopper can sign in again (the refresh flow only guards account pages).
    const signedIn = verifyAccessToken(request.cookies.get(COOKIE_NAMES.storefront.access)?.value, 'storefront').ok;
    if (!signedIn) return NextResponse.next();
    return NextResponse.redirect(new URL(returnPath(searchParams.get('next')), request.url));
  }
  return authGate(request);
}

export const config = {
  matcher: [
    '/account',
    '/account/:path*',
    '/checkout',
    '/checkout/:path*',
    '/demo-invoice',
    '/demo-invoice/:path*',
    '/login',
    '/register',
  ],
};
