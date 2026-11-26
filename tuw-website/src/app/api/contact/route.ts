import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@tuw/heart/platform/errors';
import { claim, complete, fail, hashRequest } from '@tuw/heart/platform/idempotency';
import { createTicket } from '@tuw/heart/modules/support';
import { getOrderForViewer } from '@tuw/heart/modules/orders';
import { hitRateLimit } from '@tuw/heart/platform/ratelimit';
import { requiresOrderRef } from '@storefront/lib/contact-order';
import { session } from '@/server/session';

const SCOPE = 'support.create';

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown';
  const idempotencyKey = req.headers.get('idempotency-key') ?? '';

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const orderRef = typeof body.orderRef === 'string' ? body.orderRef.trim() : '';

    if (!name) return NextResponse.json({ error: 'Please provide your full name.' }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }
    if (message.length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters long.' }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message exceeds maximum length.' }, { status: 400 });
    }
    if (requiresOrderRef(subject) && (!orderRef || orderRef.length > 50)) {
      return NextResponse.json({ error: 'Please provide your order number.' }, { status: 400 });
    }
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'A valid Idempotency-Key is required.' }, { status: 400 });
    }

    await hitRateLimit('contact.submit', [
      { key: ip, max: 5, windowSeconds: 600 },
      { key: email.toLowerCase(), max: 3, windowSeconds: 3600 },
    ]);

    const claims = await session.currentClaims();
    const gate = await claim({
      scope: SCOPE,
      actorRef: claims?.sub ? `user:${claims.sub}` : `guest:${ip}`,
      key: idempotencyKey,
      requestHash: hashRequest(SCOPE, { name, email, subject, message, orderRef }),
      userId: claims?.sub ?? null,
    });
    if (gate.kind === 'replay') return NextResponse.json(gate.body, { status: gate.status });

    if (claims?.sub && orderRef) {
      try {
        await getOrderForViewer(orderRef, { userId: claims.sub });
      } catch {
        await fail(gate.id, 400, { error: 'We could not find that order for your account.' });
        return NextResponse.json({ error: 'We could not find that order for your account.' }, { status: 400 });
      }
    }

    try {
      const ticket = await createTicket({
        name,
        email,
        subject: subject || 'General inquiry',
        message: orderRef ? `Order reference: ${orderRef}\n\n${message}` : message,
        userId: claims?.sub ?? null,
      });
      const response = { success: true, ticketId: ticket.id, message: 'Your message has been saved to our support inbox.' };
      await complete(gate.id, 200, response, { table: 'support_tickets', id: ticket.id });
      return NextResponse.json(response);
    } catch (error) {
      await fail(gate.id, 500, { error: 'Failed to save your message.' });
      throw error;
    }
  } catch (err: unknown) {
    if (err instanceof AppError && err.code === 'RATE_LIMITED') {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof AppError && err.code === 'VALIDATION_FAILED') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: 'Failed to process contact message.', details: message }, { status: 500 });
  }
}
