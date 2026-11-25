import type { Metadata } from 'next';
import ReturnsSection from '../../_components/ReturnsSection';

// Private page: kept out of search results.
export const metadata: Metadata = {
  title: 'Returns & Exchanges | The Unplugged Wear',
  description: 'Your return and exchange requests.',
  robots: { index: false, follow: true },
};

export default function AccountReturnsPage() {
  return <ReturnsSection />;
}
