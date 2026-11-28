import type { Metadata } from 'next';
import ProfileSection from '../../_components/ProfileSection';

// Private page: kept out of search results.
export const metadata: Metadata = {
  title: 'Profile | The Unplugged Wear',
  description: 'Your name, contact details and password.',
  robots: { index: false, follow: true },
};

export default function AccountProfilePage() {
  return <ProfileSection />;
}
