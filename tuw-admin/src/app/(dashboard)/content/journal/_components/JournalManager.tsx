'use client';

import { useState } from 'react';
import { savePostAction } from '@/server/marketing-actions';

type Post = { id: string; slug: string; title: string; status: string; publishedAt: string | null; authorName: string };
type Meta = { categories: { id: string; name: string }[]; authors: { id: string; name: string }[]; tags: { id: string; name: string }[] };

export default function JournalManager({ initial, meta }: { initial: Post[]; meta: Meta }) {
  const [posts, setPosts] = useState(initial);
  const [form, setForm] = useState({
    id: '', slug: '', title: '', subtitle: '', excerpt: '',
    authorId: meta.authors[0]?.id ?? '', categoryId: meta.categories[0]?.id ?? '',
    status: 'draft' as 'draft' | 'scheduled' | 'published' | 'archived',
    publishedAt: '', content: '[]', tagIds: '',
  });
  const [notice, setNotice] = useState<string | null>(null);

  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setNotice(null);
    try {
      const res = await savePostAction({
        ...(form.id ? { id: form.id } : {}),
        slug: form.slug, title: form.title, subtitle: form.subtitle || undefined,
        excerpt: form.excerpt || undefined, authorId: form.authorId,
        categoryId: form.categoryId || null, status: form.status,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
        content: JSON.parse(form.content),
        tagIds: form.tagIds.split(',').map((s) => s.trim()).filter(Boolean),
      });
      if (!res.ok) { setNotice(res.error.message); return; }
      setPosts((p) => [res.data.post, ...p.filter((x) => x.id !== res.data.post.id)]);
      const storefrontNote = res.data.storefront.ok ? '' : ` Storefront refresh failed: ${res.data.storefront.reason}`;
      setNotice(`Saved ${form.slug}.${storefrontNote}`);
    } catch {
      setNotice('Content must be valid JSON.');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Journal</h1>
      <div className="grid gap-3 max-w-2xl">
        <label className="text-sm">Slug <input className="ml-2 border rounded px-2 py-1" value={form.slug} onChange={(e) => set('slug', e.target.value)} /></label>
        <label className="text-sm">Title <input className="ml-2 border rounded px-2 py-1" value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="text-sm">Subtitle <input className="ml-2 border rounded px-2 py-1" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} /></label>
        <label className="text-sm">Excerpt <input className="ml-2 border rounded px-2 py-1" value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} /></label>
        <label className="text-sm">Author
          <select className="ml-2 border rounded px-2 py-1" value={form.authorId} onChange={(e) => set('authorId', e.target.value)}>
            {meta.authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Category
          <select className="ml-2 border rounded px-2 py-1" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">None</option>
            {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Status
          <select className="ml-2 border rounded px-2 py-1" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {['draft', 'scheduled', 'published', 'archived'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm">Publish at <input type="datetime-local" className="ml-2 border rounded px-2 py-1" value={form.publishedAt} onChange={(e) => set('publishedAt', e.target.value)} /></label>
        <label className="text-sm">Tag IDs (comma-separated) <input className="ml-2 border rounded px-2 py-1" value={form.tagIds} onChange={(e) => set('tagIds', e.target.value)} /></label>
        <label className="block text-sm">Content (JSON blocks)
          <textarea className="mt-1 w-full border rounded px-2 py-1 font-mono text-xs" rows={10} value={form.content} onChange={(e) => set('content', e.target.value)} />
        </label>
        <button className="w-fit px-4 py-2 rounded bg-black text-white" onClick={save}>Save post</button>
        {notice && <p className="text-sm">{notice}</p>}
      </div>
      <ul className="text-sm divide-y">
        {posts.map((p) => (
          <li key={p.id} className="py-2 flex justify-between">
            <span>{p.title} <span className="text-muted-foreground">/{p.slug} · {p.status}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
