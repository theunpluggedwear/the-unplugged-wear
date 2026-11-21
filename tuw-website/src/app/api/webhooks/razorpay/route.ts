import { NextRequest } from 'next/server';
import { handleProviderWebhook } from '@/server/webhook-handler';

// Razorpay posts here. Signature verification, dedupe and state changes live
// in heart (integrations/webhooks + modules/payments/webhooks).
export async function POST(req: NextRequest) {
  return handleProviderWebhook('razorpay', req);
}
