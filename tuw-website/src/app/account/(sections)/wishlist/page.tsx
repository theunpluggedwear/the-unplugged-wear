import type { Metadata } from 'next';
import WishlistSection from '../../_components/WishlistSection';

// Private page: kept out of search results.
export const metadata: Metadata = {
  title: 'Wishlist | The Unplugged Wear',
  description: 'Pieces you have saved for later.',
  robots: { index: false, follow: true },
};

export default function AccountWishlistPage() {
  return <WishlistSection />;
}
