'use client';

import { useState } from 'react';
import { savePageAction } from '@/server/content-actions';

type Page = { id: string; slug: string; title: string; blocks: Record<string, unknown>[]; isActive: boolean };

export default function PagesManager({ initial }: { initial: Page[] }) {
  const [pages, setPages] = useState(initial);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState('[]');
  const [notice, setNotice] = useState<string | null>(null);

  async function save() {
    setNotice(null);
    try {
      const parsed = JSON.parse(blocks);
      const res = await savePageAction({ slug, title, blocks: parsed, isActive: true });
      if (!res.ok) { setNotice(res.error.message); return; }
      setPages((p) => [...p.filter((x) => x.slug !== slug), res.data.page]);
      const storefrontNote = res.data.storefront.ok ? '' : ` Storefront refresh failed: ${res.data.storefront.reason}`;
      setNotice(`Saved ${slug}.${storefrontNote}`);
    } catch {
      setNotice('Blocks must be valid JSON.');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">CMS pages</h1>
      <div className="grid gap-3 max-w-2xl">
        <label className="text-sm">Slug
          <input className="ml-2 border rounded px-2 py-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="about" />
        </label>
        <label className="text-sm">Title
          <input className="ml-2 border rounded px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-sm">Blocks (JSON)
          <textarea className="mt-1 w-full border rounded px-2 py-1 font-mono text-xs" rows={8} value={blocks} onChange={(e) => setBlocks(e.target.value)} />
        </label>
        <button className="w-fit px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={!slug || !title} onClick={save}>Save page</button>
        {notice && <p className="text-sm">{notice}</p>}
      </div>
      <ul className="text-sm divide-y">
        {pages.map((p) => (
          <li key={p.id} className="py-2 flex justify-between">
            <span>{p.title} <span className="text-muted-foreground">/{p.slug}</span></span>
            <button className="underline" onClick={() => { setSlug(p.slug); setTitle(p.title); setBlocks(JSON.stringify(p.blocks, null, 2)); }}>Edit</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
