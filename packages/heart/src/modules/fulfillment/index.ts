import 'server-only';

// Fulfilment module — public API (backend-modules skill). Owns
// integration_providers (fulfilment rows), provider_product_mappings reads,
// fulfillment_orders/items, provider_wallet_ledger, provider_cod_remittances
// and fulfillment_claims (DOC/backend/16). Orders are sent by the
// `fulfillment.submitDue` job after their free-cancel window; provider state
// comes back through `fulfillment.syncOpen` (Qikink has no webhooks).
export * from './provider.ts';
export * from './submit.ts';
export * from './sync.ts';
export * from './status.ts';
export * from './wallet.ts';
export * from './remittances.ts';
export * from './claims.ts';
export * from './admin.ts';
export * as fulfillmentSchemas from './schemas.ts';
export type { FulfillmentStatusValue, ShipmentStatus, ClaimType as ClaimTypeInput } from './schemas.ts';
