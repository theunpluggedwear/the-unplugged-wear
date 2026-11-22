import { createAuthProxy } from '@tuw/heart/next/proxy';



const PUBLIC = ['/login', '/forgot-password', '/reset-password', '/accept-invite', '/signup', '/verify'];

export const proxy = createAuthProxy({
  app: 'admin',
  isProtected: (pathname) => !PUBLIC.includes(pathname) && !pathname.startsWith('/api/'),
});


export const config = { matcher: ['/((?!_next/|api/|images/|fonts/|favicon|.*\\.[a-z0-9]+$).*)'] };
