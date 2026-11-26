import type { Metadata } from 'next';
import OverviewSection from '../_components/OverviewSection';

// Private page: kept out of search results.
export const metadata: Metadata = {
  title: 'My Account | The Unplugged Wear',
  description: 'Your orders, addresses and returns at a glance.',
  robots: { index: false, follow: true },
};

export default function AccountOverviewPage() {
  return <OverviewSection />;
}
