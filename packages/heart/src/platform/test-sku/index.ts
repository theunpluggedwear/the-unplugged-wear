// Test-SKU matching, shared by checkout pricing, quoting and fulfilment.
// One env-driven source of truth replaces the old inline / Set variants and
// the hard-coded QA SKU that had to be removed before going live. A configured
// SKU matches itself and its variant suffixes (e.g. "SKU-BLACK-M").

/** True when `sku` is the configured checkout test SKU or one of its variants. */
export function isTestSku(sku: string): boolean {
  const testSku = (process.env.CHECKOUT_TEST_SKU ?? '').trim();
  return Boolean(testSku) && (sku === testSku || sku.startsWith(`${testSku}-`));
}
