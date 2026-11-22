'use client';

import { useState } from 'react';
import {
  Button,
  Checkbox,
  ContentCard,
  Input,
  PageHeader,
  RadioGroup,
  Select,
} from '@/components/ui';
import { saveHomeFeaturedAction, saveHomeJournalAction } from '@/server/content-actions';

type Mode = 'featured' | 'latest';
type Config = {
  featured: { mode: Mode; count: number; productIds: string[] };
  journal: { mode: Mode; count: number; postIds: string[]; categorySlug: string | null };
};
type Item = { id: string; title: string };

const COUNTS = [3, 6, 9, 12, 15];
const MODE_OPTIONS = [
  { value: 'featured', label: 'Featured (manual)' },
  { value: 'latest', label: 'Latest' },
];

function Picker({ items, selected, onChange, label }: { items: Item[]; selected: string[]; onChange: (ids: string[]) => void; label: string }) {
  const [query, setQuery] = useState('');
  const filtered = items.filter((i) => i.title.toLowerCase().includes(query.toLowerCase())).slice(0, 50);
  return (
    <div className="space-y-2">
      <Input label={`Search ${label}`} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="max-h-48 overflow-auto" style={{ border: '1px solid var(--tuw-border-subtle)', borderRadius: 8 }}>
        {filtered.map((item) => (
          <div key={item.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--tuw-border-subtle)' }}>
            <Checkbox
              label={item.title}
              checked={selected.includes(item.id)}
              onChange={(e) => onChange(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeCmsManager({ initial, products, posts, categories }: {
  initial: Config;
  products: Item[];
  posts: Item[];
  categories: { id: string; name: string; slug: string }[];
}) {
  const [featured, setFeatured] = useState(initial.featured);
  const [journal, setJournal] = useState(initial.journal);
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  function setCount(kind: 'featured' | 'journal', count: number) {
    if (kind === 'featured') setFeatured((f) => ({ ...f, count, productIds: f.productIds.slice(0, count) }));
    else setJournal((j) => ({ ...j, count, postIds: j.postIds.slice(0, count) }));
  }

  async function saveFeatured() {
    setNotice(null);
    if (featured.mode === 'featured' && featured.productIds.length !== featured.count) {
      setNotice({ text: `Select exactly ${featured.count} products.`, tone: 'error' });
      return;
    }
    const res = await saveHomeFeaturedAction(featured);
    if (!res.ok) { setNotice({ text: res.error.message, tone: 'error' }); return; }
    const storefrontNote = res.data.storefront.ok ? '' : ` Storefront refresh failed: ${res.data.storefront.reason}`;
    setNotice({ text: `Featured products saved.${storefrontNote}`, tone: res.data.storefront.ok ? 'success' : 'error' });
  }

  async function saveJournal() {
    setNotice(null);
    if (journal.mode === 'featured' && journal.postIds.length !== journal.count) {
      setNotice({ text: `Select exactly ${journal.count} published posts.`, tone: 'error' });
      return;
    }
    const res = await saveHomeJournalAction(journal);
    if (!res.ok) { setNotice({ text: res.error.message, tone: 'error' }); return; }
    const storefrontNote = res.data.storefront.ok ? '' : ` Storefront refresh failed: ${res.data.storefront.reason}`;
    setNotice({ text: `Journal card saved.${storefrontNote}`, tone: res.data.storefront.ok ? 'success' : 'error' });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Homepage"
        subtitle="Only the product carousel and journal cards are editable. Other homepage sections stay fixed in code."
      />

      {notice && (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          style={{ fontSize: 13, color: notice.tone === 'error' ? 'var(--tuw-text-error)' : 'var(--tuw-text-success)' }}
        >
          {notice.text}
        </p>
      )}

      <ContentCard>
        <div className="space-y-4">
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>Featured Products</h2>
          <RadioGroup
            name="featured-mode"
            options={MODE_OPTIONS}
            value={featured.mode}
            onChange={(value) => setFeatured((f) => ({ ...f, mode: value as Mode }))}
            orientation="horizontal"
          />
          <Select
            label="Count"
            value={featured.count}
            onChange={(e) => setCount('featured', Number(e.target.value))}
            options={COUNTS.map((c) => ({ value: c, label: String(c) }))}
          />
          {featured.mode === 'featured' && (
            <Picker items={products} selected={featured.productIds} onChange={(ids) => setFeatured((f) => ({ ...f, productIds: ids.slice(0, f.count) }))} label="products" />
          )}
          <Button variant="primary" size="md" onClick={() => void saveFeatured()}>Save featured products</Button>
        </div>
      </ContentCard>

      <ContentCard>
        <div className="space-y-4">
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>Journal Card</h2>
          <RadioGroup
            name="journal-mode"
            options={MODE_OPTIONS}
            value={journal.mode}
            onChange={(value) => setJournal((j) => ({ ...j, mode: value as Mode }))}
            orientation="horizontal"
          />
          <Select
            label="Count"
            value={journal.count}
            onChange={(e) => setCount('journal', Number(e.target.value))}
            options={COUNTS.map((c) => ({ value: c, label: String(c) }))}
          />
          {journal.mode === 'latest' && (
            <Select
              label="Category"
              value={journal.categorySlug ?? ''}
              onChange={(e) => setJournal((j) => ({ ...j, categorySlug: e.target.value || null }))}
              options={[{ value: '', label: 'All published' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
            />
          )}
          {journal.mode === 'featured' && (
            <Picker items={posts} selected={journal.postIds} onChange={(ids) => setJournal((j) => ({ ...j, postIds: ids.slice(0, j.count) }))} label="posts" />
          )}
          <Button variant="primary" size="md" onClick={() => void saveJournal()}>Save journal card</Button>
        </div>
      </ContentCard>
    </div>
  );
}
