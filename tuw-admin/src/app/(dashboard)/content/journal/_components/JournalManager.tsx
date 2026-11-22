'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  ContentCard,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@/components/ui';
import { savePostAction } from '@/server/marketing-actions';
import { MONO_ID_STYLE } from '@/lib/format';

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
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

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
      if (!res.ok) { setNotice({ text: res.error.message, tone: 'error' }); return; }
      setPosts((p) => [res.data.post, ...p.filter((x) => x.id !== res.data.post.id)]);
      const storefrontNote = res.data.storefront.ok ? '' : ` Storefront refresh failed: ${res.data.storefront.reason}`;
      setNotice({ text: `Saved ${form.slug}.${storefrontNote}`, tone: res.data.storefront.ok ? 'success' : 'error' });
      setForm({ ...form, id: '', slug: '', title: '', subtitle: '', excerpt: '', publishedAt: '', content: '[]', tagIds: '' });
    } catch {
      setNotice({ text: 'Content must be valid JSON.', tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal"
        subtitle="Editorial posts. Use the full editor for rich content and revisions."
        actions={<LinkButton href="/content/journal/new" variant="primary" size="md">New story</LinkButton>}
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
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Slug" value={form.slug} onChange={(e) => set('slug', e.target.value)} required />
          <Input label="Title" value={form.title} onChange={(e) => set('title', e.target.value)} required />
          <Input label="Subtitle" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
          <Input label="Excerpt" value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
          <Select
            label="Author"
            value={form.authorId}
            onChange={(e) => set('authorId', e.target.value)}
            options={meta.authors.map((a) => ({ value: a.id, label: a.name }))}
          />
          <Select
            label="Category"
            value={form.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
            options={[{ value: '', label: 'None' }, ...meta.categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            options={['draft', 'scheduled', 'published', 'archived'].map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))}
          />
          <Input label="Publish at" type="datetime-local" value={form.publishedAt} onChange={(e) => set('publishedAt', e.target.value)} />
          <Input label="Tag IDs (comma-separated)" value={form.tagIds} onChange={(e) => set('tagIds', e.target.value)} />
          <div className="md:col-span-2">
            <Textarea label="Content (JSON blocks)" rows={10} value={form.content} onChange={(e) => set('content', e.target.value)} className="font-mono" />
          </div>
          <div className="md:col-span-2">
            <Button variant="primary" size="md" onClick={() => void save()}>{form.id ? 'Update post' : 'Save post'}</Button>
          </div>
        </div>
      </ContentCard>

      {posts.length === 0 ? (
        <EmptyState title="No posts yet" description="Saved stories will appear here." />
      ) : (
        <ContentCard padding="0px">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.id} hoverable={false}>
                  <TableCell>{p.title}</TableCell>
                  <TableCell style={MONO_ID_STYLE}>/{p.slug}</TableCell>
                  <TableCell><Badge variant={p.status === 'published' ? 'success' : 'neutral'}>{p.status}</Badge></TableCell>
                  <TableCell>
                    <LinkButton href={`/content/journal/${p.id}/edit`} variant="secondary" size="sm">Open editor</LinkButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentCard>
      )}
    </div>
  );
}
