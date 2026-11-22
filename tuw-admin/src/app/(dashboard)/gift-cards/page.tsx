export const instant = false;
import { adminListGiftCards } from '@tuw/heart/modules/gift-cards';
import { session } from '@/server/session';
import GiftCardsView from './_components/GiftCardsView';

export default async function GiftCardsPage() {
  const claims = await session.requireStaff('giftcard.manage', '/gift-cards');
  const initial = await adminListGiftCards({ status: 'all', page: 1, perPage: 20 }, claims.sub);
  return <GiftCardsView initial={initial} perms={claims.perms} />;
}