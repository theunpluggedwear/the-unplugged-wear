'use client';

import { useState } from 'react';
import { deleteDesignAction, saveDesignAction } from '@/server/content-actions';

type Design = {
  id: string; name: string; category: string; designer: string | null; placement: string | null;
  dimensions: string | null; fileFormat: string | null; fileSizeBytes: number | null; status: string; notes: string | null;
};
const empty = {
  id: '', name: '', category: 'print_artwork' as const, designer: '', placement: '', dimensions: '',
  fileFormat: '', fileSizeBytes: '', status: 'in_review' as const, notes: '',
};

export default function DesignsManager({ initial }: { initial: Design[] }) {
  const [items, setItems] = useState(initial);
  const [form, setForm] = useState({ ...empty });
  const [notice, setNotice] = useState<string | null>(null);
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setNotice(null);
    const res = await saveDesignAction({
      ...(form.id ? { id: form.id } : {}),
      name: form.name, category: form.category, designer: form.designer || null, placement: form.placement || null,
      dimensions: form.dimensions || null, fileFormat: form.fileFormat || null,
      fileSizeBytes: form.fileSizeBytes ? Number(form.fileSizeBytes) : null,
      status: form.status, notes: form.notes || null,
    });
    if (!res.ok) { setNotice(res.error.message); return; }
    setItems((list) => [res.data, ...list.filter((d) => d.id !== res.data.id)]);
    setForm({ ...empty });
    setNotice('Saved.');
  }

  async function remove(id: string) {
    const res = await deleteDesignAction({ id });
    if (!res.ok) { setNotice(res.error.message); return; }
    setItems((list) => list.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Design assets</h1>
      <div className="grid gap-3 max-w-2xl">
        <label className="text-sm">Name <input className="ml-2 border rounded px-2 py-1" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="text-sm">Category
          <select className="ml-2 border rounded px-2 py-1" value={form.category} onChange={(e) => set('category', e.target.value as typeof form.category)}>
            {['print_artwork', 'embroidery', 'typography', 'label_spec'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-sm">Designer <input className="ml-2 border rounded px-2 py-1" value={form.designer} onChange={(e) => set('designer', e.target.value)} /></label>
        <label className="text-sm">Placement <input className="ml-2 border rounded px-2 py-1" value={form.placement} onChange={(e) => set('placement', e.target.value)} /></label>
        <label className="text-sm">Dimensions <input className="ml-2 border rounded px-2 py-1" value={form.dimensions} onChange={(e) => set('dimensions', e.target.value)} /></label>
        <label className="text-sm">File format <input className="ml-2 border rounded px-2 py-1" value={form.fileFormat} onChange={(e) => set('fileFormat', e.target.value)} /></label>
        <label className="text-sm">File size (bytes) <input type="number" className="ml-2 border rounded px-2 py-1" value={form.fileSizeBytes} onChange={(e) => set('fileSizeBytes', e.target.value)} /></label>
        <label className="text-sm">Status
          <select className="ml-2 border rounded px-2 py-1" value={form.status} onChange={(e) => set('status', e.target.value as typeof form.status)}>
            {['in_review', 'approved', 'archived'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="block text-sm">Notes <textarea className="mt-1 w-full border rounded px-2 py-1" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></label>
        <button className="w-fit px-4 py-2 rounded bg-black text-white" onClick={save}>Save design</button>
        {notice && <p className="text-sm">{notice}</p>}
      </div>
      <ul className="text-sm divide-y">
        {items.map((d) => (
          <li key={d.id} className="py-2 flex justify-between">
            <span>{d.name} · {d.category} · {d.status}</span>
            <span className="flex gap-3">
              <button className="underline" onClick={() => setForm({ id: d.id, name: d.name, category: d.category as typeof form.category, designer: d.designer ?? '', placement: d.placement ?? '', dimensions: d.dimensions ?? '', fileFormat: d.fileFormat ?? '', fileSizeBytes: d.fileSizeBytes ? String(d.fileSizeBytes) : '', status: d.status as typeof form.status, notes: d.notes ?? '' })}>Edit</button>
              <button className="underline text-red-600" onClick={() => remove(d.id)}>Delete</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
