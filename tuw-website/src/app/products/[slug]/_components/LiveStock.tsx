import { getProductStock } from '@/server/catalog';
import StockSink from './StockSink';

// The one dynamic part of the product page: stock, read fresh per request.
// It is a sibling of the cached body rather than a wrapper around it, so the
// gallery and buy box stay in the static shell and only this hole streams.
// A failed live read is not worth a whole-page error: the buy box keeps using
// the sizes from the cached catalogue until the next refresh, so the stream's
// error boundary ends here instead of reaching the route's error page.
export default async function LiveStock({ slug, productId }: { slug: string; productId?: string }) {
  let sizes: Awaited<ReturnType<typeof getProductStock>> = null;
  try {
    sizes = await getProductStock(productId);
  } catch (error) {
    console.error('[live-stock] fresh stock read failed:', (error as Error).message);
  }
  if (!sizes) return null;
  return <StockSink slug={slug} sizes={sizes} />;
}
