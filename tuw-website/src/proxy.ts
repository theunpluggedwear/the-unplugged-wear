import { createAuthProxy } from '@tuw/heart/next/proxy';

// Optimistic gate only (auth-guards skill): account pages need a session.
// Every action and data read re-checks through the guards / DAL.
export const proxy = createAuthProxy({
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

export const config = {
  matcher: ['/account', '/account/:path*', '/checkout', '/checkout/:path*', '/demo-invoice', '/demo-invoice/:path*'],
};
