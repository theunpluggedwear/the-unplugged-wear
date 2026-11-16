// Fulfilment partner interface + adapters (DOC/backend/16 §1, §5). Until the
// integrations phase (TL-INT-QIKINK) Qikink runs as a SIMULATOR in sandbox:
// it accepts orders and reports Qikink's words, but nothing reaches Qikink.

export type FulfillmentStatus =
  | 'pending' | 'submitted' | 'on_hold' | 'in_production' | 'shipped'
  | 'delivery_exception' | 'delivered' | 'rto_initiated' | 'returned'
  | 'cancelled' | 'failed';

export interface FulfillmentOrderLine {
  sku: string;
  quantity: number;
  /** What the customer paid for one unit. Providers that print invoices need it. */
  unitPricePaise?: number;
  /** Strategy-B fields (print type, designs, placement) from the mapping. */
  payload?: Record<string, unknown>;
}

export interface FulfillmentOrderInput {
  /** Our external_ref (sent as Qikink order_number). */
  reference: string;
  gateway: 'prepaid' | 'cod';
  codAmountPaise?: number;
  /** Order value the provider records (COD amount or the paid total). */
  totalPaise?: number;
  lines: FulfillmentOrderLine[];
  /** Qikink's create call requires an email and a 2-letter country code. */
  shipTo: { name: string; line1: string; line2?: string | null; city: string; state: string; postalCode: string; phone: string; email: string; country?: string };
}

export interface ProviderOrderState {
  providerOrderRef: string;
  providerStatus: string;
  status: FulfillmentStatus;
  courier?: string | null;
  awb?: string | null;
  /** Provider charge for this order, when the answer carries it. */
  providerCostPaise?: number | null;
  /** Raw provider answer, stored on fulfillment_orders.raw_payload. */
  raw?: Record<string, unknown>;
}

export interface FulfillmentPartner {
  slug: string;
  liveReady(): boolean;
  createOrder(input: FulfillmentOrderInput): Promise<ProviderOrderState>;
  getOrder(providerOrderRef: string): Promise<ProviderOrderState>;
  cancelOrder(providerOrderRef: string): Promise<{ cancelled: boolean; providerStatus: string }>;
  mapStatus(raw: string): FulfillmentStatus;
}

const QIKINK_STATUS: Record<string, FulfillmentStatus> = {
  'on hold': 'on_hold',
  'live oos': 'on_hold',
  live: 'submitted',
  'to be printed': 'in_production',
  'partially picklisted': 'in_production',
  printed: 'in_production',
  manifested: 'in_production',
  'in-transit': 'shipped',
  'in transit': 'shipped',
  exception: 'delivery_exception',
  delivered: 'delivered',
  'rto initiated': 'rto_initiated',
  returned: 'returned',
  cancelled: 'cancelled',
};

/** Unknown words map to on_hold (ops alert) — never silently to a happy state. */
export const mapQikinkStatus = (raw: string): FulfillmentStatus => QIKINK_STATUS[raw.trim().toLowerCase()] ?? 'on_hold';

function validate(input: FulfillmentOrderInput) {
  if (!input.reference) throw new RangeError('reference is required');
  if (!input.lines.length || input.lines.some((l) => !l.sku || !Number.isInteger(l.quantity) || l.quantity < 1)) throw new RangeError('every line needs a SKU and a quantity ≥ 1');
  if (input.gateway === 'cod' && !(Number.isSafeInteger(input.codAmountPaise) && (input.codAmountPaise ?? 0) > 0)) throw new RangeError('COD orders need a positive codAmountPaise');
}

/** Qikink simulator: orders start "Live"; cancel only while Live (Qikink rule).
 * Used whenever QIKINK_CLIENT_ID / QIKINK_CLIENT_SECRET are not configured;
 * the real HTTP client lives in qikink.ts and shares this status map. */
export function createQikinkSimulator(): FulfillmentPartner {
  const orders = new Map<string, string>(); // providerOrderRef → Qikink status word
  return {
    slug: 'qikink',
    liveReady: () => false,
    mapStatus: mapQikinkStatus,
    async createOrder(input) {
      validate(input);
      const ref = `sim_qk_${input.reference}`;
      if (!orders.has(ref)) orders.set(ref, 'Live'); // same reference → same order (idempotent)
      const word = orders.get(ref)!;
      return { providerOrderRef: ref, providerStatus: word, status: mapQikinkStatus(word) };
    },
    async getOrder(ref) {
      const word = orders.get(ref);
      if (!word) throw new RangeError(`Unknown simulated order ${ref}`);
      return { providerOrderRef: ref, providerStatus: word, status: mapQikinkStatus(word) };
    },
    async cancelOrder(ref) {
      const word = orders.get(ref);
      if (!word) throw new RangeError(`Unknown simulated order ${ref}`);
      if (word !== 'Live') return { cancelled: false, providerStatus: word };
      orders.set(ref, 'Cancelled');
      return { cancelled: true, providerStatus: 'Cancelled' };
    },
  };
}

/** In-house atelier: staff move the status by hand; the adapter only records. */
export const customAtelier: FulfillmentPartner = {
  slug: 'custom_atelier',
  liveReady: () => true,
  mapStatus: (raw) => (raw as FulfillmentStatus),
  async createOrder(input) {
    validate(input);
    return { providerOrderRef: `atelier_${input.reference}`, providerStatus: 'submitted', status: 'submitted' };
  },
  async getOrder(ref) {
    return { providerOrderRef: ref, providerStatus: 'submitted', status: 'submitted' };
  },
  async cancelOrder() {
    return { cancelled: true, providerStatus: 'cancelled' };
  },
};

export const qikinkSimulator = createQikinkSimulator();
