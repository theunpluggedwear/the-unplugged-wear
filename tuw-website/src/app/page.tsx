import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import { getCatalog } from '@/server/catalog';
import { cmsHomeSections, cmsPosts } from '@/server/cms';
import CmsHome from './_components/CmsHome';
import LegacyHome from './_components/LegacyHome';

export default async function HomePage() {
  const [sections, catalog, posts] = await Promise.all([
    cmsHomeSections(),
    getCatalog(),
    cmsPosts({ perPage: 3 }),
  ]);

  if (!sections.length) {
    return (
      <>
        <div className="bg-store-cream px-4 py-2 text-center text-xs text-store-muted">
          Home sections are in demo mode until CMS content is published.
        </div>
        <LegacyHome />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-store-canvas">
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <CmsHome sections={sections} products={catalog.products} posts={posts.rows} />
      </main>
      <Footer />
    </div>
  );
}
