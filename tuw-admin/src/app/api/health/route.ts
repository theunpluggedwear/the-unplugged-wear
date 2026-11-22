import { connection } from 'next/server';
import { checkDatabase } from '@tuw/heart/platform/db';



export async function GET() {
  await connection();
  try {
    const db = await checkDatabase();
    return Response.json({ app: 'tuw-admin', status: 'ok', db });
  } catch (error) {
    console.error('[health] database check failed', error);
    return Response.json({ app: 'tuw-admin', status: 'error', db: { ok: false } }, { status: 503 });
  }
}
