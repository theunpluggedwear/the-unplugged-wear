import type { Metadata } from 'next';
import OrdersSection from '../../_components/OrdersSection';

// Private page: kept out of search results.
export const metadata: Metadata = {
  title: 'Order History | The Unplugged Wear',
  description: 'Your orders with The Unplugged Wear.',
  robots: { index: false, follow: true },
};

export default function AccountOrdersPage() {
  return <OrdersSection />;
}
