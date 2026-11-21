import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@tuw/heart/platform/errors';
import { getEmailSender } from '@tuw/heart/integrations/email';
import * as settings from '@tuw/heart/modules/settings';
import { hitRateLimit } from '@tuw/heart/platform/ratelimit';

/**
 * Public contact endpoint. The form is still a demo: the only email adapter in
 * this phase is the mock sender, which records a row in email_logs and sends
 * nothing. The response must never claim a reply or a delivery that did not
 * happen (CLN-BE-011).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const { name, email, subject, message } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Please provide your full name.' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters long.' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message exceeds maximum length.' }, { status: 400 });
    }

    // Public endpoint: throttle both the visitor and the sender address.
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || 'unknown';
    await hitRateLimit('contact.submit', [
      { key: ip, max: 5, windowSeconds: 600 },
      { key: email.trim().toLowerCase(), max: 3, windowSeconds: 3600 },
    ]);

    // Persist through the demo outbox. `delivered` is false with the mock
    // sender, so the response below can state exactly what happened.
    const recipient = (await settings.getPublicSettings()).supportEmail;
    const topic = typeof subject === 'string' && subject.trim() ? subject.trim().slice(0, 60) : 'General inquiry';
    const result = await getEmailSender().send({
      to: recipient,
      subject: `Website inquiry — ${topic}`,
      template: 'contact.inquiry',
    });

    return NextResponse.json({
      success: true,
      demo: !result.delivered,
      delivered: result.delivered,
      message: result.delivered
        ? 'Your inquiry has been delivered.'
        : `Demo mode — no email has been sent and your message has not been delivered. If you need a reply, please write to ${recipient}.`,
    });
  } catch (err: unknown) {
    if (err instanceof AppError && err.code === 'RATE_LIMITED') {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: 'Failed to process contact message.', details: message }, { status: 500 });
  }
}
