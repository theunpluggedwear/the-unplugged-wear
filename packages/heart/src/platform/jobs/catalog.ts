import 'server-only';
import { registerJob, listJobs, runJob } from './index.ts';
import { sweepExpired } from '../idempotency/index.ts';
import { notifyRestocked } from '../../modules/inventory/index.ts';
import { submitDueOrders, syncOpenFulfillment } from '../../modules/fulfillment/index.ts';
import { expireDue } from '../../modules/gift-cards/index.ts';
import { reconcilePendingPayments, retryFailedWebhooks } from '../../modules/payments/index.ts';
import { sweepRateLimits } from '../ratelimit/index.ts';

// Every job the system runs, registered in one place so any trigger (Cron
// route, CLI, worker) sees the same list. Modules add theirs here as they
// land (TL-BE-06 inventory.notifyRestocked, TL-BE-11 fulfillment.*, …).
let loaded = false;

export function loadJobs(): void {
  if (loaded) return;
  loaded = true;
  registerJob({
    name: 'platform.sweepIdempotencyKeys',
    description: 'Delete expired idempotency_keys rows (TTL sweep, DOC/backend/21).',
    run: async () => ({ processed: await sweepExpired() }),
  });
  registerJob({
    name: 'platform.sweepRateLimits',
    description: 'Delete rate_limit_hits rows older than a day.',
    run: async () => ({ processed: await sweepRateLimits() }),
  });
  registerJob({
    name: 'inventory.notifyRestocked',
    description: 'Email everyone waiting on an item that is buyable again (DOC/backend/22).',
    run: notifyRestocked,
  });
  registerJob({
    name: 'fulfillment.submitDue',
    description: 'Hand paid orders to their print partner once the free-cancel window closes (DOC/backend/16 §6).',
    run: () => submitDueOrders(25),
  });
  registerJob({
    name: 'fulfillment.syncOpen',
    description: 'Poll the partner for parcel status and tracking on every open order (DOC/backend/16 §7).',
    run: () => syncOpenFulfillment(50),
  });

  registerJob({
    name: 'giftCards.expireDue',
    description: 'Flip gift cards past their expiry date to expired (DOC/backend/22).',
    run: expireDue,
  });

  registerJob({
    name: 'payments.reconcileRazorpay',
    description: 'Poll provider status for pending payment intents and expire abandoned orders.',
    run: reconcilePendingPayments,
  });

  registerJob({
    name: 'webhooks.retryFailed',
    description: 'Retry failed provider webhook deliveries from the durable inbox.',
    run: retryFailedWebhooks,
  });
}

export { listJobs, runJob };
