'use client';

import { useState } from 'react';
import { saveHomeFeaturedAction, saveHomeJournalAction } from '@/server/content-actions';

type Mode = 'featured' | 'latest';
type Config = {
  featured: { mode: Mode; count: number; productIds: string[] };
  journal: { mode: Mode; count: number; postIds: string[]; categorySlug: string | null };
};
type Item = { id: string; title: string };

const COUNTS = [3, 6, 9, 12, 15];

function Picker({ items, selected, onChange, label }: { items: Item[]; selected: string[]; onChange: (ids: string[]) => void; label: string }) {
  const [query, setQuery] = useState('');
  const filtered = items.filter((i) => i.title.toLowerCase().includes(query.toLowerCase())).slice(0, 50);
  return (
    <div className="space-y-2">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${label}`} className="w-full border rounded px-2 py-1 text-sm" />
      <div className="max-h-48 overflow-auto border rounded divide-y text-sm">
        {filtered.map((item) => (
          <label key={item.id} className="flex items-center gap-2 p-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={(e) => onChange(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
            />
            <span className="truncate">{item.title}</span>
          </label>
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
  const [notice, setNotice] = useState<string | null>(null);

  function setCount(kind: 'featured' | 'journal', count: number) {
    if (kind === 'featured') setFeatured((f) => ({ ...f, count, productIds: f.productIds.slice(0, count) }));
    else setJournal((j) => ({ ...j, count, postIds: j.postIds.slice(0, count) }));
  }

  async function saveFeatured() {
    setNotice(null);
    if (featured.mode === 'featured' && featured.productIds.length !== featured.count) {
      setNotice(`Select exactly ${featured.count} products.`);
      return;
    }
    const res = await saveHomeFeaturedAction(featured);
    setNotice(res.ok ? 'Featured products saved.' : res.error.message);
  }

  async function saveJournal() {
    setNotice(null);
    if (journal.mode === 'featured' && journal.postIds.length !== journal.count) {
      setNotice(`Select exactly ${journal.count} published posts.`);
      return;
    }
    const res = await saveHomeJournalAction(journal);
    setNotice(res.ok ? 'Journal card saved.' : res.error.message);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Homepage</h1>
      <p className="text-sm text-muted-foreground">Only the product carousel and journal cards are editable. All other homepage sections stay fixed in code.</p>

      <section className="border rounded-lg p-4 space-y-4 max-w-3xl">
        <h2 className="text-lg font-medium">Featured Products</h2>
        <div className="flex gap-4 text-sm">
          {(['featured', 'latest'] as Mode[]).map((mode) => (
            <label key={mode} className="flex items-center gap-1">
              <input type="radio" checked={featured.mode === mode} onChange={() => setFeatured((f) => ({ ...f, mode }))} />
              {mode === 'featured' ? 'Featured (manual)' : 'Latest'}
            </label>
          ))}
        </div>
        <label className="block text-sm">Count
          <select className="ml-2 border rounded px-2 py-1" value={featured.count} onChange={(e) => setCount('featured', Number(e.target.value))}>
            {COUNTS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {featured.mode === 'featured' && (
          <Picker items={products} selected={featured.productIds} onChange={(ids) => setFeatured((f) => ({ ...f, productIds: ids.slice(0, f.count) }))} label="products" />
        )}
        <button className="px-4 py-2 rounded bg-black text-white" onClick={saveFeatured}>Save featured products</button>
      </section>

      <section className="border rounded-lg p-4 space-y-4 max-w-3xl">
        <h2 className="text-lg font-medium">Journal Card</h2>
        <div className="flex gap-4 text-sm">
          {(['featured', 'latest'] as Mode[]).map((mode) => (
            <label key={mode} className="flex items-center gap-1">
              <input type="radio" checked={journal.mode === mode} onChange={() => setJournal((j) => ({ ...j, mode }))} />
              {mode === 'featured' ? 'Featured (manual)' : 'Latest'}
            </label>
          ))}
        </div>
        <label className="block text-sm">Count
          <select className="ml-2 border rounded px-2 py-1" value={journal.count} onChange={(e) => setCount('journal', Number(e.target.value))}>
            {COUNTS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {journal.mode === 'latest' && (
          <label className="block text-sm">Category
            <select className="ml-2 border rounded px-2 py-1" value={journal.categorySlug ?? ''} onChange={(e) => setJournal((j) => ({ ...j, categorySlug: e.target.value || null }))}>
              <option value="">All published</option>
              {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
        )}
        {journal.mode === 'featured' && (
          <Picker items={posts} selected={journal.postIds} onChange={(ids) => setJournal((j) => ({ ...j, postIds: ids.slice(0, j.count) }))} label="posts" />
        )}
        <button className="px-4 py-2 rounded bg-black text-white" onClick={saveJournal}>Save journal card</button>
      </section>

      {notice && <p className="text-sm">{notice}</p>}
    </div>
  );
}
