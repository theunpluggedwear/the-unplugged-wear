import { getCatalog } from '@/server/catalog';
import { cmsHomeConfig, cmsHomePosts } from '@/server/cms';
import LegacyHome from './_components/LegacyHome';

export default async function HomePage() {
  // Sequence the two cached reads. `getCatalog()` is also filled by the root
  // layout; starting both fills in the same tick lets this page's dynamic-stage
  // invocation join (and halt on) the layout's pending cache entry — Next's
  // "use cache" deadlock probe reports that as a 500 on `/`. Awaiting the
  // config first keeps the catalog fill sequential and reuses the layout's
  // already-cached read instead of racing it.
  const config = await cmsHomeConfig();
  const catalog = await getCatalog();
  const count = config.featured.count;

  let featuredProducts = catalog.products.slice(0, count);
  if (config.featured.mode === 'featured' && config.featured.productIds.length) {
    const ids = new Set(config.featured.productIds);
    const chosen = catalog.products.filter((p) => ids.has(p.productId ?? p.id));
    if (chosen.length) featuredProducts = chosen.slice(0, count);
  }

  const journalPosts = await cmsHomePosts(config.journal);

  return (
    <LegacyHome
      products={featuredProducts}
      journalPosts={journalPosts}
      featuredCount={count}
      journalCount={config.journal.count}
    />
  );
}
