export const instant = false;
import { adminListCategories } from '@tuw/heart/modules/catalog';
import { session } from '@/server/session';
import CategoriesView from './_components/CategoriesView';



export default async function CategoriesPage() {
  const claims = await session.requireStaff(undefined, '/products/categories');
  return <CategoriesView initialCategories={await adminListCategories()} canManage={claims.perms.includes('category.manage')} />;
}
