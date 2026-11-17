'use client';

import { useState } from 'react';
import { deleteSectionAction, saveSectionAction } from '@/server/content-actions';

type Section = { id: string; key: string; type: string; title: string | null; content: Record<string, unknown>; settings: Record<string, unknown>; sortOrder: number };
const empty = { id: '', key: '', type: 'hero' as const, title: '', content: '{}', settings: '{}', sortOrder: 0 };

export default function HomeSectionsManager({ initial }: { initial: Section[] }) {
  const [sections, setSections] = useState(initial);
  const [form, setForm] = useState({ ...empty });
  const [notice, setNotice] = useState<string | null>(null);
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setNotice(null);
    try {
      const res = await saveSectionAction({
        ...(form.id ? { id: form.id } : {}),
        key: form.key, pageKey: 'home', type: form.type, title: form.title || null,
        content: JSON.parse(form.content), settings: JSON.parse(form.settings), sortOrder: form.sortOrder,
      });
      if (!res.ok) { setNotice(res.error.message); return; }
      setSections((s) => [res.data, ...s.filter((x) => x.id !== res.data.id)].sort((a, b) => a.sortOrder - b.sortOrder));
      setForm({ ...empty });
      setNotice('Saved.');
    } catch { setNotice('Content and settings must be valid JSON.'); }
  }

  async function remove(id: string) {
    const res = await deleteSectionAction({ id });
    if (!res.ok) { setNotice(res.error.message); return; }
    setSections((s) => s.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Home sections</h1>
      <div className="grid gap-3 max-w-2xl">
        <label className="text-sm">Key <input className="ml-2 border rounded px-2 py-1" value={form.key} onChange={(e) => set('key', e.target.value)} /></label>
        <label className="text-sm">Type
          <select className="ml-2 border rounded px-2 py-1" value={form.type} onChange={(e) => set('type', e.target.value as typeof form.type)}>
            {['hero', 'banner', 'featured_products', 'blog_teaser', 'brands', 'testimonial'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm">Title <input className="ml-2 border rounded px-2 py-1" value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="text-sm">Order <input type="number" className="ml-2 border rounded px-2 py-1 w-20" value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></label>
        <label className="block text-sm">Content JSON <textarea className="mt-1 w-full border rounded px-2 py-1 font-mono text-xs" rows={8} value={form.content} onChange={(e) => set('content', e.target.value)} /></label>
        <label className="block text-sm">Settings JSON <textarea className="mt-1 w-full border rounded px-2 py-1 font-mono text-xs" rows={4} value={form.settings} onChange={(e) => set('settings', e.target.value)} /></label>
        <button className="w-fit px-4 py-2 rounded bg-black text-white" onClick={save}>Save section</button>
        {notice && <p className="text-sm">{notice}</p>}
      </div>
      <ul className="text-sm divide-y">
        {sections.map((s) => (
          <li key={s.id} className="py-2 flex justify-between">
            <span>{s.key} · {s.type} · order {s.sortOrder}</span>
            <span className="flex gap-3">
              <button className="underline" onClick={() => setForm({ id: s.id, key: s.key, type: s.type as typeof form.type, title: s.title ?? '', content: JSON.stringify(s.content, null, 2), settings: JSON.stringify(s.settings, null, 2), sortOrder: s.sortOrder })}>Edit</button>
              <button className="underline text-red-600" onClick={() => remove(s.id)}>Delete</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
