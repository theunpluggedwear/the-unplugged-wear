import DashboardShell from '@/components/layout/DashboardShell';
import { adminListFaqs } from '@tuw/heart/modules/content';
import { adminListCategories, getStorefrontCatalog } from '@tuw/heart/modules/catalog';
import { session } from '@/server/session';
import FaqsManager from './_components/FaqsManager';

export default async function ContentFaqsPage() {
  const claims = await session.requireStaff('content.manage', '/content/faqs');
  const [faqs, catalog, categories] = await Promise.all([
    adminListFaqs(claims.sub),
    getStorefrontCatalog(),
    adminListCategories(),
  ]);
  return (
    <DashboardShell>
      <FaqsManager
        initial={faqs}
        products={catalog.products.map((p) => ({ id: p.productId, title: p.title }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </DashboardShell>
  );
}
