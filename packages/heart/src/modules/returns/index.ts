import 'server-only';

// Returns module — public API (backend-modules skill). Owns returns,
// return_items and return_status_history (DOC/backend/06, 13). Approving an
// exchange or replacement creates its follow-up order through the orders
// module and refunds a negative difference through payments, all in one
// transaction.
export * from './eligibility.ts';
export * from './customer.ts';
export * from './admin.ts';
export * as returnSchemas from './schemas.ts';
export type { ReturnStatus, Disposition, CreateReturnInput } from './schemas.ts';
