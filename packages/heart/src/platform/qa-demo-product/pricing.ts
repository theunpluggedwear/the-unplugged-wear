import 'server-only';
import type { ShippingRates, Totals } from '../../modules/orders/pricing.ts';
import { QA_DEMO_FIXED_PAISE } from './sku.ts';

/** QA product never pays shipping and always settles at exactly ₹1. */
export function qaDemoShippingRates(): ShippingRates {
  return { freeThresholdPaise: 0, standardFeePaise: 0, expressFeePaise: 0, codFeePaise: 0 };
}

export function qaDemoTotals(): Totals {
  return {
    subtotalPaise: QA_DEMO_FIXED_PAISE,
    discountPaise: 0,
    shippingPaise: 0,
    taxPaise: 0,
    giftCardPaise: 0,
    grandTotalPaise: QA_DEMO_FIXED_PAISE,
  };
}
