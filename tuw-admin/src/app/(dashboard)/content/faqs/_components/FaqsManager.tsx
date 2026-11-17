'use client';

import { useState } from 'react';
import { deleteFaqAction, saveFaqAction } from '@/server/content-actions';

type Faq = {
  id: string;
  scope: 'general' | 'product' | 'category';
  productId: string | null;
  categoryId: string | null;
  groupLabel: string | null;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
  productName?: string | null;
  categoryName?: string | null;
};

const empty = {
  id: '', scope: 'general' as Faq['scope'], productId: '', categoryId: '', groupLabel: '',
  question: '', answer: '', sortOrder: 0, isPublished: true,
};

export default function FaqsManager({ initial, products, categories }: {
  initial: Faq[];
  products: { id: string; title: string }[];
  categories: { id: string; name: string }[];
}) {
  const [faqs, setFaqs] = useState(initial);
  const [form, setForm] = useState({ ...empty });
  const [notice, setNotice] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function edit(f: Faq) {
    setForm({ id: f.id, scope: f.scope, productId: f.productId ?? '', categoryId: f.categoryId ?? '',
      groupLabel: f.groupLabel ?? '', question: f.question, answer: f.answer, sortOrder: f.sortOrder, isPublished: f.isPublished });
  }

  async function save() {
    setNotice(null);
    const res = await saveFaqAction({
      ...(form.id ? { id: form.id } : {}),
      scope: form.scope,
      productId: form.scope === 'product' ? form.productId || null : null,
      categoryId: form.scope === 'category' ? form.categoryId || null : null,
      groupLabel: form.groupLabel || undefined,
      question: form.question, answer: form.answer,
      sortOrder: form.sortOrder, isPublished: form.isPublished,
    });
    if (!res.ok) { setNotice(res.error.message); return; }
    setFaqs((list) => [res.data, ...list.filter((f) => f.id !== res.data.id)]);
    setForm({ ...empty });
    setNotice('Saved.');
  }

  async function remove(id: string) {
    const res = await deleteFaqAction({ id });
    if (!res.ok) { setNotice(res.error.message); return; }
    setFaqs((list) => list.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">FAQs</h1>
      <div className="grid gap-3 max-w-2xl">
        <label className="text-sm">Scope
          <select className="ml-2 border rounded px-2 py-1" value={form.scope} onChange={(e) => set('scope', e.target.value as Faq['scope'])}>
            <option value="general">General</option><option value="product">Product</option><option value="category">Category</option>
          </select>
        </label>
        {form.scope === 'product' && (
          <label className="text-sm">Product
            <select className="ml-2 border rounded px-2 py-1" value={form.productId} onChange={(e) => set('productId', e.target.value)}>
              <option value="">Choose…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        )}
        {form.scope === 'category' && (
          <label className="text-sm">Category
            <select className="ml-2 border rounded px-2 py-1" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-sm">Group label (general) <input className="ml-2 border rounded px-2 py-1" value={form.groupLabel} onChange={(e) => set('groupLabel', e.target.value)} /></label>
        <label className="text-sm">Question <input className="ml-2 border rounded px-2 py-1" value={form.question} onChange={(e) => set('question', e.target.value)} /></label>
        <label className="block text-sm">Answer <textarea className="mt-1 w-full border rounded px-2 py-1" rows={4} value={form.answer} onChange={(e) => set('answer', e.target.value)} /></label>
        <label className="text-sm">Sort order <input type="number" className="ml-2 border rounded px-2 py-1 w-20" value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></label>
        <label className="text-sm">Published <input type="checkbox" className="ml-2" checked={form.isPublished} onChange={(e) => set('isPublished', e.target.checked)} /></label>
        <button className="w-fit px-4 py-2 rounded bg-black text-white" onClick={save}>Save FAQ</button>
        {notice && <p className="text-sm">{notice}</p>}
      </div>
      <ul className="text-sm divide-y">
        {faqs.map((f) => (
          <li key={f.id} className="py-2 flex justify-between gap-3">
            <span>{f.question} <span className="text-muted-foreground">· {f.scope} · {f.isPublished ? 'published' : 'draft'}</span></span>
            <span className="flex gap-3"><button className="underline" onClick={() => edit(f)}>Edit</button><button className="underline text-red-600" onClick={() => remove(f.id)}>Delete</button></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
