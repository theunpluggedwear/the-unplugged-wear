import type { ReactNode } from 'react';
import AccountShell from '../_components/AccountShell';

// Orders, Addresses, Returns and Profile share one frame that stays mounted
// while the shopper moves between them (one URL per section).
export default function AccountSectionsLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
