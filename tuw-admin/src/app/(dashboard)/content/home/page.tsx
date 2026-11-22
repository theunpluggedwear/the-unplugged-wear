export const instant = false;
import { adminGetHomeCms } from '@tuw/heart/modules/content';
import { adminListPosts, adminJournalMeta } from '@tuw/heart/modules/marketing';
import { getStorefrontCatalog } from '@tuw/heart/modules/catalog';
import { session } from '@/server/session';
import HomeCmsManager from './_components/HomeCmsManager';

export default async function ContentHomePage() {
  const claims = await session.requireStaff('content.manage', '/content/home');
  const [config, catalog, posts, meta] = await Promise.all([
    adminGetHomeCms(claims.sub),
    getStorefrontCatalog(),
    adminListPosts({ status: 'published', page: 1, perPage: 100 }, claims.sub),
    adminJournalMeta(claims.sub),
  ]);
  return (
    <>
      <HomeCmsManager
        initial={config}
        products={catalog.products.map((p) => ({ id: p.productId ?? p.id, title: p.title }))}
        posts={posts.rows.map((p) => ({ id: p.id, title: p.title }))}
        categories={meta.categories}
      />
    </>
  );
}
