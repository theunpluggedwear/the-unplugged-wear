export const instant = false;
import { adminListCollections, adminListProducts } from '@tuw/heart/modules/catalog';
import { session } from '@/server/session';
import type { CollectionItem, ProductItem } from '@/lib/admin-dto';
import CollectionsView from './_components/CollectionsView';

export default async function CollectionsPage() {
  const claims = await session.requireStaff(undefined, '/collections');
  const [collections, products] = await Promise.all([adminListCollections(), adminListProducts()]);
  
  const origin = process.env.STOREFRONT_URL ?? '';
  const withOrigin = products.map((p) => ({ ...p, images: p.images.map((u) => (u.startsWith('/') ? `${origin}${u}` : u)) }));
  return <CollectionsView initialCollections={collections as CollectionItem[]} products={withOrigin as unknown as ProductItem[]} canManage={claims.perms.includes('product.update')} />;
}
