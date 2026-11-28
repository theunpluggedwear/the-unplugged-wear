import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAnalyticsEvents } from '@tuw/heart/modules/analytics';
import { hitRateLimit } from '@tuw/heart/platform/ratelimit';
import { AppError } from '@tuw/heart/platform/errors';
import { session } from '@/server/session';

const eventSchema = z.object({
  pageViews: z.array(z.object({
    id: z.string().uuid(),
    page: z.string().min(1).max(500),
    referrer: z.string().max(2048).optional(),
    eventKind: z.enum(['pageview', 'heartbeat']).optional(),
    durationMs: z.number().int().min(0).max(86400000).optional(),
    exited: z.boolean().optional(),
  })).max(50).optional(),
  productViews: z.array(z.object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
  })).max(50).optional(),
  cartEvents: z.array(z.object({
    id: z.string().uuid(),
    cartId: z.string().uuid(),
    eventType: z.enum(['item_added', 'item_removed', 'qty_changed', 'cart_viewed']),
    payload: z.record(z.unknown()).optional(),
  })).max(50).optional(),
  searches: z.array(z.object({
    id: z.string().uuid(),
    term: z.string().min(1).max(255),
    hits: z.number().int().min(0),
    resultsClicked: z.number().int().min(0).optional(),
  })).max(50).optional(),
}).refine((value) =>
  Object.values(value).some((list) => Array.isArray(list) && list.length > 0),
{ message: 'Send at least one event.' });

export async function POST(req: NextRequest) {
  try {
    const parsed = eventSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid event payload.', details: parsed.error.issues.slice(0, 5) }, { status: 400 });
    }

    const context = await session.resolveContext();
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || 'unknown';
    await hitRateLimit('analytics.ingest', [
      { key: ip, max: 300, windowSeconds: 600 },
      { key: context.guestSessionId ?? context.user?.id ?? ip, max: 100, windowSeconds: 600 },
    ]);

    const sessionId = context.guestSessionId ?? await session.ensureGuestId();
    const result = await recordAnalyticsEvents(
      { sessionId, userId: context.user?.id ?? null },
      parsed.data,
    );
    return NextResponse.json({ ok: true, recorded: result });
  } catch (error) {
    if (error instanceof AppError && error.code === 'RATE_LIMITED') {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : '';
    if (/foreign key|violates/.test(message)) {
      return NextResponse.json({ error: 'An event referenced an unknown product or cart.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Could not record analytics events.' }, { status: 500 });
  }
}
