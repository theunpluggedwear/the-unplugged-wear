import { getCatalog } from '@/server/catalog';
import { cmsHomeConfig, cmsHomePosts } from '@/server/cms';
import LegacyHome from './_components/LegacyHome';

export default async function HomePage() {
  const [config, catalog] = await Promise.all([cmsHomeConfig(), getCatalog()]);
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
