import { NextRequest, NextResponse } from 'next/server';
import { ingestWebhook } from '@tuw/heart/modules/payments';

/** Generic webhook entry point: provider slug comes from the route, never the client. */
export async function handleProviderWebhook(provider: string, req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const result = await ingestWebhook(provider, rawBody, req.headers);
  return NextResponse.json(result.body, { status: result.status });
}
