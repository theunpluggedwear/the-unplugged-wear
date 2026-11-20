import Breadcrumb from '@storefront/components/ui/Breadcrumb';
import Disclosure from '@storefront/components/ui/Disclosure';
import { cmsGeneralFaqs } from '@/server/cms';

export default async function FaqPage() {
  const groups = await cmsGeneralFaqs();
  return (
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Help & FAQ' }]} />
        <div className="my-8">
          <h1 className="text-[clamp(1.75rem,4vw+0.5rem,3rem)] font-extrabold tracking-tight text-store-charcoal">Frequently Asked Questions</h1>
          <p className="text-sm text-store-muted mt-2 leading-relaxed">
            Everything you need to know about sizing, printing to order, shipping and returns.
          </p>
        </div>
        {groups.length === 0 && <p className="text-sm text-store-text-secondary">No FAQs published yet.</p>}
        {groups.map((group) => (
          <section key={group.label} className="mb-10">
            <h2 className="text-lg font-semibold text-store-charcoal mb-2">{group.label}</h2>
            <div className="border-t border-store-card-border">
              {group.faqs.map((faq) => (
                <Disclosure key={faq.id} title={faq.question}>
                  <p className="text-sm text-store-text-secondary leading-relaxed whitespace-pre-wrap">{faq.answer}</p>
                </Disclosure>
              ))}
            </div>
          </section>
        ))}
      </main>
  );
}
