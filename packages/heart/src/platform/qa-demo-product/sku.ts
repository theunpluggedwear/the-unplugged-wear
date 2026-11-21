import 'server-only';

/**
 * Single isolated QA demo product guardrail.
 *
 * This is intentionally code-only and keyed by SKU: no DB migration, env flag
 * or admin UI. Remove this module and its guarded call sites when the QA
 * product is no longer needed.
 */
export const QA_DEMO_SKU = 'TUW-TEST-PRODUCT-49F1AA';
export const QA_DEMO_FIXED_PAISE = 100;
export const QA_DEMO_INVOICE_PROVIDER = 'qa_demo_invoice';

const normalize = (sku: string): string => sku.trim();

/** True for the QA demo SKU itself or any of its variants. */
export function isQaDemoSku(sku: string | null | undefined): boolean {
  if (!sku) return false;
  const value = normalize(sku);
  return value === QA_DEMO_SKU || value.startsWith(`${QA_DEMO_SKU}-`);
}

export function containsQaDemoSku(skus: Array<string | null | undefined>): boolean {
  return skus.some(isQaDemoSku);
}

export function onlyQaDemoSku(skus: Array<string | null | undefined>): boolean {
  const values = skus.filter(Boolean) as string[];
  return values.length > 0 && values.every(isQaDemoSku);
}

export function qaDemoFulfillmentSkipReason(): string {
  return 'QA demo product — fulfilment submission is blocked.';
}
