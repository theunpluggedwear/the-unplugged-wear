export const instant = false;
import { adminListReviews } from '@tuw/heart/modules/catalog';
import { session } from '@/server/session';
import ReviewsView from './_components/ReviewsView';


export default async function ReviewsPage() {
  await session.requireStaff('product.update', '/products/reviews');
  return <ReviewsView initialReviews={await adminListReviews()} />;
}
