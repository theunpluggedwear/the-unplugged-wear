'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  ContentCard,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { deleteMediaAction, saveMediaAction } from '@/server/content-actions';

type Media = {
  id: string; url: string; filename: string | null; alt: string | null; usage: string; mimeType: string | null;
};
const empty = { id: '', url: '', filename: '', alt: '', usage: 'section' as const, mimeType: '' };

export default function MediaManager({ initial }: { initial: Media[] }) {
  const [items, setItems] = useState(initial);
  const [form, setForm] = useState({ ...empty });
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setNotice(null);
    const res = await saveMediaAction({
      ...(form.id ? { id: form.id } : {}),
      url: form.url, filename: form.filename || null, alt: form.alt || null,
      mimeType: form.mimeType || null, usage: form.usage,
    });
    if (!res.ok) { setNotice({ text: res.error.message, tone: 'error' }); return; }
    setItems((list) => [res.data, ...list.filter((m) => m.id !== res.data.id)]);
    setForm({ ...empty });
    setNotice({ text: 'Saved. Files are not uploaded yet — this is a demo metadata library.', tone: 'success' });
  }

  async function remove(id: string) {
    const res = await deleteMediaAction({ id });
    if (!res.ok) { setNotice({ text: res.error.message, tone: 'error' }); return; }
    setItems((list) => list.filter((m) => m.id !== id));
    setNotice({ text: 'Asset removed.', tone: 'success' });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Library"
        subtitle="Metadata and URLs only until the storage integration is connected."
        actions={
          <Badge variant="warning">Demo storage</Badge>
        }
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
          <div className="md:col-span-2">
            <Input label="URL" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://… or /images/…" required />
          </div>
          <Input label="Filename" value={form.filename} onChange={(e) => set('filename', e.target.value)} />
          <Input label="Alt text" value={form.alt} onChange={(e) => set('alt', e.target.value)} />
          <Select
            label="Usage"
            value={form.usage}
            onChange={(e) => set('usage', e.target.value as typeof form.usage)}
            options={['product', 'section', 'blog', 'design'].map((u) => ({ value: u, label: u[0]!.toUpperCase() + u.slice(1) }))}
          />
          <Input label="MIME type" value={form.mimeType} onChange={(e) => set('mimeType', e.target.value)} placeholder="image/jpeg" />
          <div className="md:col-span-2">
            <Button variant="primary" size="md" onClick={() => void save()}>{form.id ? 'Update asset' : 'Save asset'}</Button>
          </div>
        </div>
      </ContentCard>

      {items.length === 0 ? (
        <EmptyState title="No media assets yet" description="Saved metadata and URLs will appear here." />
      ) : (
        <ContentCard padding="0px">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Asset</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>MIME</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id} hoverable={false}>
                  <TableCell>
                    <div className="truncate" style={{ maxWidth: 360 }}>{m.filename ?? m.url}</div>
                  </TableCell>
                  <TableCell><Badge variant="neutral">{m.usage}</Badge></TableCell>
                  <TableCell>{m.mimeType ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setForm({ id: m.id, url: m.url, filename: m.filename ?? '', alt: m.alt ?? '', usage: m.usage as typeof form.usage, mimeType: m.mimeType ?? '' })}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => void remove(m.id)}>Delete</Button>
                    </div>
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
