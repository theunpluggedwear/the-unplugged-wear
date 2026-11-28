import 'server-only';
import { AppError } from '../../platform/errors/index.ts';
import { personalizationDesignPayload } from '../../modules/personalization/index.ts';
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
// The client always talks to the live API (https://api.qikink.com, override with
// QIKINK_BASE_URL). liveReady() is true the moment both keys exist, so the
// registry lets the provider row go live with no second switch.
//
// Endpoints other than POST /api/token and POST /api/order/create are the
// documented-but-unverified ones from DOC/backend/16 §8; the sync job records
// any failure on the fulfillment_orders row instead of guessing a status.

const TOKEN_TTL_MS = 45 * 60_000;
const TIMEOUT_MS = 20_000;

export const QIKINK_MAX_REQUESTS_PER_MINUTE = 30;
export const QIKINK_RATE_LIMIT_WINDOW_MS = 60_000;

export function qikinkBackoffDelayMs(timestamps: readonly number[], now = Date.now()): number {
  const recent = timestamps
    .filter((at) => Number.isFinite(at) && at <= now && now - at < QIKINK_RATE_LIMIT_WINDOW_MS)
    .sort((a, b) => a - b);
  if (recent.length < QIKINK_MAX_REQUESTS_PER_MINUTE) return 0;
  return Math.max(0, recent[recent.length - QIKINK_MAX_REQUESTS_PER_MINUTE]! + QIKINK_RATE_LIMIT_WINDOW_MS - now);
}

export interface QikinkConfig {
  clientId: string;
  clientSecret: string;
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
  const configuredBase = trimmed(process.env.QIKINK_BASE_URL) || trimmed(process.env.QIKINK_ENDPOINT);
  const baseUrl = (configuredBase || 'https://api.qikink.com').replace(/\/+$/, '');
  return { clientId, clientSecret, baseUrl };
}

/** What the admin screens show: keys present (live API) or simulator? */
export function qikinkHealth(): { configured: boolean; baseUrl: string; simulated: boolean } {
  const config = qikinkConfig();
  return {
    configured: Boolean(config),
    baseUrl: config?.baseUrl ?? 'https://api.qikink.com',
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

async function call(config: QikinkConfig, path: string, init: { method?: string; body?: unknown; token?: string; form?: Record<string, string> } = {}): Promise<unknown> {
  // Verified against the sandbox on 2026-11-16: the token endpoint only reads
  // form-urlencoded fields, and every authenticated call needs BOTH
  // `Accesstoken` and `ClientId` headers (DOC/backend/16 §8.1).
  const headers: Record<string, string> = { Accept: 'application/json', ClientId: config.clientId };
  let payload: string | undefined;
  if (init.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(init.form).toString();
  } else {
    headers['Content-Type'] = 'application/json';
    payload = init.body === undefined ? undefined : JSON.stringify(init.body);
  }
  if (init.token) headers.Accesstoken = init.token;
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: payload,
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
  const key = `${config.baseUrl}:${config.clientId}`;
  const cached = tokens.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const body = await call(config, '/api/token', {
    method: 'POST',
    form: { ClientId: config.clientId, client_secret: config.clientSecret },
  });
  const token = text(pick(body, ['Accesstoken', 'accesstoken', 'access_token', 'AccessToken', 'token']));
  if (!token) throw new QikinkError('Qikink returned no access token (DOC/backend/16 §8.1).', null, body);
  tokens.set(key, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

async function withFreshTokenOn401<T>(config: QikinkConfig, send: (token: string) => Promise<T>): Promise<T> {
  const key = `${config.baseUrl}:${config.clientId}`;
  let token: string;
  try {
    token = await accessToken(config);
  } catch (error) {
    if (!(error instanceof QikinkError) || error.status !== 401) throw error;
    tokens.delete(key);
    token = await accessToken(config);
  }
  try {
    return await send(token);
  } catch (error) {
    if (!(error instanceof QikinkError) || error.status !== 401) throw error;
    tokens.delete(key);
    return send(await accessToken(config));
  }
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] ?? 'Customer', last_name: parts.slice(1).join(' ') || '-' };
}

const COUNTRY_CODE: Record<string, string> = { india: 'IN', in: 'IN' };
const countryCode = (value: string | undefined): string => COUNTRY_CODE[(value ?? 'India').trim().toLowerCase()] ?? 'IN';

/**
 * The verified create body (sandbox probe, 2026-11-16 — DOC/backend/16 §8.2):
 *   * shipping_address takes `country_code` ("IN") and requires `email`;
 *     a `country` field is rejected as unexpected;
 *   * a store SKU line (search_from_my_products: 1) must NOT carry
 *     print_type_id or designs — Qikink reads both from the SKU;
 *   * Strategy B (our artwork) needs print_type_id + designs instead.
 */
export function createBody(input: FulfillmentOrderInput): Record<string, unknown> {
  const { first_name, last_name } = splitName(input.shipTo.name);
  const total = input.gateway === 'cod' ? input.codAmountPaise ?? input.totalPaise : input.totalPaise;
  return {
    order_number: input.reference,
    qikink_shipping: 1,
    gateway: input.gateway === 'cod' ? 'COD' : 'Prepaid',
    total_order_value: rupees(total),
    line_items: input.lines.map((line) => {
      const base = { quantity: String(line.quantity), sku: line.sku, price: rupees(line.unitPricePaise) };
      const design = personalizationDesignPayload(line);
      return design ? { ...base, ...design } : { ...base, search_from_my_products: 1 };
    }),
    shipping_address: {
      first_name,
      last_name,
      address1: input.shipTo.line1,
      address2: input.shipTo.line2 ?? '',
      city: input.shipTo.city,
      province: input.shipTo.state,
      zip: input.shipTo.postalCode,
      phone: input.shipTo.phone,
      email: input.shipTo.email,
      country_code: countryCode(input.shipTo.country),
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
    liveReady: () => true,
    mapStatus: mapQikinkStatus,
    async createOrder(input) {
      const body = await withFreshTokenOn401(config, (token) =>
        call(config, '/api/order/create', { method: 'POST', token, body: createBody(input) }));
      const state = stateFrom(body, input.reference);
      // A create answer rarely carries the provider status; "Live" is Qikink's
      // accepted state, which the first poll then confirms.
      return { ...state, providerStatus: state.providerStatus === 'Live' ? 'Live' : state.providerStatus, status: mapQikinkStatus(state.providerStatus) };
    },
    async getOrder(providerOrderRef) {
      // Qikink's own id is numeric; anything else is our reference, which is
      // found in the order list (verified: GET /api/order answers an array).
      if (/^\d+$/.test(providerOrderRef)) {
        const body = await withFreshTokenOn401(config, (token) => call(config, `/api/order?order_id=${encodeURIComponent(providerOrderRef)}`, { token }));
        return stateFrom(body, providerOrderRef);
      }
      const list = await withFreshTokenOn401(config, (token) => call(config, '/api/order', { token }));
      const rows = Array.isArray(list)
        ? list
        : Array.isArray((list as { data?: unknown } | null)?.data)
          ? ((list as { data: unknown[] }).data)
          : [];
      const match = rows.find((row) => text(pick(row, ['order_number', 'orderNumber', 'reference'])) === providerOrderRef);
      if (!match) throw new QikinkError(`Qikink has no order ${providerOrderRef}.`, 404, list);
      return stateFrom(match, providerOrderRef);
    },
    async cancelOrder(providerOrderRef) {
      try {
        const body = await withFreshTokenOn401(config, (token) => call(config, '/api/order/cancel', { method: 'POST', token, body: { order_id: providerOrderRef } }));
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
    liveReady: () => true,
    // Once keys exist, a simulated order would be a lie: always use the API.
    createOrder: (input) => client.createOrder(input),
    getOrder: (ref) => client.getOrder(ref),
    cancelOrder: (ref) => client.cancelOrder(ref),
  };
}
