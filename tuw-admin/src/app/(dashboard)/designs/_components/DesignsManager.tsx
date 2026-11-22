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
  Textarea,
} from '@/components/ui';
import { deleteDesignAction, saveDesignAction } from '@/server/content-actions';

type Design = {
  id: string; name: string; category: string; designer: string | null; placement: string | null;
  dimensions: string | null; fileFormat: string | null; fileSizeBytes: number | null; status: string; notes: string | null;
};
const empty = {
  id: '', name: '', category: 'print_artwork' as const, designer: '', placement: '', dimensions: '',
  fileFormat: '', fileSizeBytes: '', status: 'in_review' as const, notes: '',
};

const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function DesignsManager({ initial }: { initial: Design[] }) {
  const [items, setItems] = useState(initial);
  const [form, setForm] = useState({ ...empty });
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
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
    if (!res.ok) { setNotice({ text: res.error.message, tone: 'error' }); return; }
    setItems((list) => [res.data, ...list.filter((d) => d.id !== res.data.id)]);
    setForm({ ...empty });
    setNotice({ text: 'Design saved.', tone: 'success' });
  }

  async function remove(id: string) {
    const res = await deleteDesignAction({ id });
    if (!res.ok) { setNotice({ text: res.error.message, tone: 'error' }); return; }
    setItems((list) => list.filter((d) => d.id !== id));
    setNotice({ text: 'Design deleted.', tone: 'success' });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Design Assets"
        subtitle="Artwork, embroidery, typography and label specifications."
        actions={<Button variant="primary" size="md" onClick={() => void save()}>{form.id ? 'Update design' : 'Save design'}</Button>}
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
          <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => set('category', e.target.value as typeof form.category)}
            options={['print_artwork', 'embroidery', 'typography', 'label_spec'].map((c) => ({ value: c, label: label(c) }))}
          />
          <Input label="Designer" value={form.designer} onChange={(e) => set('designer', e.target.value)} />
          <Input label="Placement" value={form.placement} onChange={(e) => set('placement', e.target.value)} />
          <Input label="Dimensions" value={form.dimensions} onChange={(e) => set('dimensions', e.target.value)} />
          <Input label="File format" value={form.fileFormat} onChange={(e) => set('fileFormat', e.target.value)} />
          <Input label="File size (bytes)" type="number" value={form.fileSizeBytes} onChange={(e) => set('fileSizeBytes', e.target.value)} />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as typeof form.status)}
            options={['in_review', 'approved', 'archived'].map((s) => ({ value: s, label: label(s) }))}
          />
          <div className="md:col-span-2">
            <Textarea label="Notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
      </ContentCard>

      {items.length === 0 ? (
        <EmptyState title="No design assets yet" description="Saved artwork and specifications will appear here." />
      ) : (
        <ContentCard padding="0px">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id} hoverable={false}>
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{label(d.category)}</TableCell>
                  <TableCell><Badge variant={d.status === 'approved' ? 'success' : d.status === 'archived' ? 'neutral' : 'warning'}>{label(d.status)}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setForm({ id: d.id, name: d.name, category: d.category as typeof form.category, designer: d.designer ?? '', placement: d.placement ?? '', dimensions: d.dimensions ?? '', fileFormat: d.fileFormat ?? '', fileSizeBytes: d.fileSizeBytes ? String(d.fileSizeBytes) : '', status: d.status as typeof form.status, notes: d.notes ?? '' })}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => void remove(d.id)}>Delete</Button>
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
