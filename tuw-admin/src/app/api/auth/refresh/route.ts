import { session } from '@/server/session';


export const GET = (request: Request) => session.refreshRoute(request);
