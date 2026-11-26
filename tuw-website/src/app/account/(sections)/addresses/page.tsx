import type { Metadata } from 'next';
import AddressesSection from '../../_components/AddressesSection';

// Private page: kept out of search results.
export const metadata: Metadata = {
  title: 'Addresses | The Unplugged Wear',
  description: 'Your saved delivery addresses.',
  robots: { index: false, follow: true },
};

export default function AccountAddressesPage() {
  return <AddressesSection />;
}