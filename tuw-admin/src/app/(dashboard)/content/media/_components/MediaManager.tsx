'use client';

import { useState } from 'react';
import { deleteMediaAction, saveMediaAction } from '@/server/content-actions';

type Media = {
  id: string; url: string; filename: string | null; alt: string | null; usage: string; mimeType: string | null;
};
const empty = { id: '', url: '', filename: '', alt: '', usage: 'section' as const, mimeType: '' };

export default function MediaManager({ initial }: { initial: Media[] }) {
  const [items, setItems] = useState(initial);
  const [form, setForm] = useState({ ...empty });
  const [notice, setNotice] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setNotice(null);
    const res = await saveMediaAction({
      ...(form.id ? { id: form.id } : {}),
      url: form.url, filename: form.filename || null, alt: form.alt || null,
      mimeType: form.mimeType || null, usage: form.usage,
    });
    if (!res.ok) { setNotice(res.error.message); return; }
    setItems((list) => [res.data, ...list.filter((m) => m.id !== res.data.id)]);
    setForm({ ...empty });
    setNotice('Saved. Files are not uploaded yet — this is a demo metadata library.');
  }

  async function remove(id: string) {
    const res = await deleteMediaAction({ id });
    if (!res.ok) { setNotice(res.error.message); return; }
    setItems((list) => list.filter((m) => m.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Media library</h1>
      <p className="text-sm text-muted-foreground">Demo mode: metadata and URLs only. No files are uploaded until the storage integration is connected.</p>
      <div className="grid gap-3 max-w-2xl">
        <label className="text-sm">URL <input className="ml-2 border rounded px-2 py-1 w-80" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://… or /images/…" /></label>
        <label className="text-sm">Filename <input className="ml-2 border rounded px-2 py-1" value={form.filename} onChange={(e) => set('filename', e.target.value)} /></label>
        <label className="text-sm">Alt text <input className="ml-2 border rounded px-2 py-1" value={form.alt} onChange={(e) => set('alt', e.target.value)} /></label>
        <label className="text-sm">Usage
          <select className="ml-2 border rounded px-2 py-1" value={form.usage} onChange={(e) => set('usage', e.target.value as typeof form.usage)}>
            {['product', 'section', 'blog', 'design'].map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label className="text-sm">MIME type <input className="ml-2 border rounded px-2 py-1" value={form.mimeType} onChange={(e) => set('mimeType', e.target.value)} placeholder="image/jpeg" /></label>
        <button className="w-fit px-4 py-2 rounded bg-black text-white" onClick={save}>Save asset</button>
        {notice && <p className="text-sm">{notice}</p>}
      </div>
      <ul className="text-sm divide-y">
        {items.map((m) => (
          <li key={m.id} className="py-2 flex justify-between gap-3">
            <span className="truncate">{m.filename ?? m.url} <span className="text-muted-foreground">· {m.usage}</span></span>
            <span className="flex gap-3 shrink-0">
              <button className="underline" onClick={() => setForm({ id: m.id, url: m.url, filename: m.filename ?? '', alt: m.alt ?? '', usage: m.usage as typeof form.usage, mimeType: m.mimeType ?? '' })}>Edit</button>
              <button className="underline text-red-600" onClick={() => remove(m.id)}>Delete</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
