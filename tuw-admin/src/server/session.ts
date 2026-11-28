import 'server-only';
import { createAppSession } from '@tuw/heart/next/session';
import { createGuards } from '@tuw/heart/platform/guards';



export const session = createAppSession('admin');
export const guards = createGuards({ resolveContext: session.resolveContext });
