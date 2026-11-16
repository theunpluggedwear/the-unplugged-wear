import 'server-only';
import { AppError } from '../../platform/errors/index.ts';
import {
  mapQikinkStatus,
  qikinkSimulator,
  type FulfillmentOrderInput,
  type FulfillmentPartner,
  type ProviderOrderState,
} from './adapters.ts';

// Real Qikink client (DOC/backend/16 §7). It is the SAME adapter the services
// already use: with QIKINK_CLIENT_ID + QIKINK_CLIENT_SECRET in env it makes
// HTTP calls; without them every method delegates to the simulator, so dev,
// tests and previews keep working with no key at all. Dropping the two keys in
// the admin env is the only step needed to start talking to Qikink.
//
// QIKINK_MODE=sandbox (default) → sandbox.qikink.com; QIKINK_MODE=live →
// api.qikink.com, and only then does liveReady() become true (the registry
// refuses to switch a provider to live without it).
//
// Endpoints other than POST /api/token and POST /api/order/create are the
// documented-but-unverified ones from DOC/backend/16 §8; the sync job records
// any failure on the fulfillment_orders row instead of guessing a status.

const TOKEN_TTL_MS = 45 * 60_000;
const TIMEOUT_MS = 20_000;

export type QikinkMode = 'sandbox' | 'live';

export interface QikinkConfig {
  clientId: string;
  clientSecret: string;
  mode: QikinkMode;
  baseUrl: string;
}

export class QikinkError extends Error {
  readonly status: number | null;
  readonly body: unknown;
  constructor(message: string, status: number | null = null, body: unknown = null) {
    super(message);
    this.name = 'QikinkError';
    this.status = status;
    this.body = body;
  }
}

const trimmed = (value: string | undefined): string => (value ?? '').trim();

/** Null when the two secrets are missing — the simulator then handles everything. */
export function qikinkConfig(): QikinkConfig | null {
  const clientId = trimmed(process.env.QIKINK_CLIENT_ID);
  const clientSecret = trimmed(process.env.QIKINK_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  const mode: QikinkMode = trimmed(process.env.QIKINK_MODE).toLowerCase() === 'live' ? 'live' : 'sandbox';
  const configuredBase = mode === 'live'
    ? trimmed(process.env.QIKINK_LIVE_BASE_URL) || trimmed(process.env.QIKINK_ENDPOINT)
    : trimmed(process.env.QIKINK_SANDBOX_BASE_URL) || trimmed(process.env.QIKINK_ENDPOINT);
  const baseUrl = (configuredBase || (mode === 'live' ? 'https://api.qikink.com' : 'https://sandbox.qikink.com')).replace(/\/+$/, '');
  return { clientId, clientSecret, mode, baseUrl };
}

/** What the admin fulfilment screen shows: key present? simulator or API? */
export function qikinkHealth(): { configured: boolean; mode: QikinkMode; baseUrl: string; simulated: boolean } {
  const config = qikinkConfig();
  return {
    configured: Boolean(config),
    mode: config?.mode ?? 'sandbox',
    baseUrl: config?.baseUrl ?? 'https://sandbox.qikink.com',
    simulated: !config,
  };
}

const tokens = new Map<string, { token: string; expiresAt: number }>();

const text = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

/** First non-empty value among `keys`, looking in the object and one level down. */
function pick(source: unknown, keys: string[]): unknown {
  if (!source || typeof source !== 'object') return undefined;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const direct = record[key];
    if (direct !== undefined && direct !== null && direct !== '') return direct;
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const found = pick(nested, keys);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

const rupees = (paise: number | undefined | null): string => (Math.max(0, Math.round(paise ?? 0)) / 100).toFixed(2);

async function call(config: QikinkConfig, path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json', ClientId: config.clientId };
  if (init.token) headers.Accesstoken = init.token;
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new QikinkError(`Qikink did not answer ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const raw = await response.text();
  let body: unknown = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!response.ok) {
    const message = text(pick(body, ['message', 'error', 'error_message', 'msg'])) ?? raw.slice(0, 300);
    throw new QikinkError(`Qikink ${init.method ?? 'GET'} ${path} failed (${response.status}): ${message}`, response.status, body);
  }
  const failure = text(pick(body, ['error', 'error_message'])) ?? (body && typeof body === 'object' && (body as Record<string, unknown>).success === false ? 'the provider said success=false' : null);
  if (failure) throw new QikinkError(`Qikink ${init.method ?? 'GET'} ${path} refused the order: ${failure}`, response.status, body);
  return body;
}

async function accessToken(config: QikinkConfig): Promise<string> {
  const key = `${config.mode}:${config.clientId}`;
  const cached = tokens.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const body = await call(config, '/api/token', {
    method: 'POST',
    body: { ClientId: config.clientId, client_secret: config.clientSecret },
  });
  const token = text(pick(body, ['Accesstoken', 'accesstoken', 'access_token', 'AccessToken', 'token']));
  if (!token) throw new QikinkError('Qikink returned no access token (DOC/backend/16 §8.1).', null, body);
  tokens.set(key, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] ?? 'Customer', last_name: parts.slice(1).join(' ') || '-' };
}

function createBody(input: FulfillmentOrderInput): Record<string, unknown> {
  const { first_name, last_name } = splitName(input.shipTo.name);
  const total = input.gateway === 'cod' ? input.codAmountPaise ?? input.totalPaise : input.totalPaise;
  return {
    order_number: input.reference,
    qikink_shipping: 1,
    gateway: input.gateway === 'cod' ? 'COD' : 'Prepaid',
    total_order_value: rupees(total),
    line_items: input.lines.map((line) => ({
      search_from_my_products: 1,
      print_type_id: Number(line.payload?.printTypeId ?? 1),
      quantity: String(line.quantity),
      sku: line.sku,
      price: rupees(line.unitPricePaise),
      // Strategy B fields, when a mapping carries them (DOC/backend/16 §6).
      designs: Array.isArray(line.payload?.designs) ? line.payload.designs : [],
    })),
    shipping_address: {
      first_name,
      last_name,
      address1: input.shipTo.line1,
      address2: input.shipTo.line2 ?? '',
      city: input.shipTo.city,
      province: input.shipTo.state,
      zip: input.shipTo.postalCode,
      country: input.shipTo.country ?? 'India',
      phone: input.shipTo.phone,
    },
  };
}

const stateFrom = (body: unknown, fallbackRef: string): ProviderOrderState => {
  const rawStatus = text(pick(body, ['order_status', 'status', 'OrderStatus'])) ?? 'Live';
  const ref = text(pick(body, ['order_id', 'orderId', 'OrderId', 'provider_order_id'])) ?? fallbackRef;
  const courier = text(pick(body, ['courier', 'courier_name', 'CourierName']));
  const awb = text(pick(body, ['awb', 'awb_number', 'tracking_number', 'trackingNumber']));
  const cost = pick(body, ['price', 'provider_cost', 'total_charge']);
  const costNumber = cost === undefined ? null : Number(cost);
  return {
    providerOrderRef: ref,
    providerStatus: rawStatus,
    status: mapQikinkStatus(rawStatus),
    courier,
    awb,
    providerCostPaise: costNumber !== null && Number.isFinite(costNumber) ? Math.round(costNumber * 100) : null,
    raw: body && typeof body === 'object' ? { response: body } : { response: String(body) },
  };
};

/** The real client; every method throws QikinkError (mapped by the caller). */
export function createQikinkClient(config: QikinkConfig): FulfillmentPartner {
  return {
    slug: 'qikink',
    liveReady: () => config.mode === 'live',
    mapStatus: mapQikinkStatus,
    async createOrder(input) {
      const token = await accessToken(config);
      const body = await call(config, '/api/order/create', { method: 'POST', token, body: createBody(input) });
      const state = stateFrom(body, input.reference);
      // A create answer rarely carries the provider status; "Live" is Qikink's
      // accepted state, which the first poll then confirms.
      return { ...state, providerStatus: state.providerStatus === 'Live' ? 'Live' : state.providerStatus, status: mapQikinkStatus(state.providerStatus) };
    },
    async getOrder(providerOrderRef) {
      const token = await accessToken(config);
      const body = await call(config, `/api/order?order_id=${encodeURIComponent(providerOrderRef)}`, { token });
      return stateFrom(body, providerOrderRef);
    },
    async cancelOrder(providerOrderRef) {
      const token = await accessToken(config);
      try {
        const body = await call(config, '/api/order/cancel', { method: 'POST', token, body: { order_id: providerOrderRef } });
        const status = text(pick(body, ['order_status', 'status'])) ?? 'Cancelled';
        return { cancelled: mapQikinkStatus(status) === 'cancelled' || status.toLowerCase().includes('cancel'), providerStatus: status };
      } catch (error) {
        // Qikink cancels only while the order is Live (DOC/backend/16 §4).
        if (error instanceof QikinkError) throw error;
        throw new AppError('RULE_VIOLATION', `Qikink could not cancel ${providerOrderRef}.`);
      }
    },
  };
}

/**
 * The adapter the registry and the fulfilment module load. One object, two
 * behaviours: API when keys exist, simulator when they do not.
 */
export function createQikinkPartner(): FulfillmentPartner {
  const config = qikinkConfig();
  if (!config) {
    return { ...qikinkSimulator, liveReady: () => false };
  }
  const client = createQikinkClient(config);
  return {
    ...client,
    liveReady: () => config.mode === 'live',
    // Once keys exist, a simulated order would be a lie: always use the API.
    createOrder: (input) => client.createOrder(input),
    getOrder: (ref) => client.getOrder(ref),
    cancelOrder: (ref) => client.cancelOrder(ref),
  };
}
