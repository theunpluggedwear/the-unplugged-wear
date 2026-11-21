'use client';

import { createContext, use, useContext, type ReactNode } from 'react';

export type PaymentConfig = {
  provider: string;
  available: boolean;
  live: boolean;
  testMode: boolean;
  keyId: string | null;
};

const PaymentConfigContext = createContext<PaymentConfig | null>(null);

/**
 * Gateway capabilities are read on the server (see checkout/layout.tsx) and
 * streamed into the browser as a promise resolved with `use()`, matching the
 * account/session providers. The checkout and order-confirmation screens no
 * longer fire a read-only Server Action in an effect after hydration
 * (CLN-NXT-006), and the request starts the read during the server render.
 */
export function PaymentConfigProvider({ config, children }: { config: Promise<PaymentConfig>; children: ReactNode }) {
  const value = use(config);
  return <PaymentConfigContext.Provider value={value}>{children}</PaymentConfigContext.Provider>;
}

export function usePaymentConfig(): PaymentConfig {
  const config = useContext(PaymentConfigContext);
  if (!config) throw new Error('usePaymentConfig must be used inside PaymentConfigProvider');
  return config;
}
