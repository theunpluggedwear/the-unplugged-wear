'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  ContentCard,
  EmptyState,
  Input,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@/components/ui';
import { savePageAction } from '@/server/content-actions';
import { MONO_ID_STYLE } from '@/lib/format';

type Page = { id: string; slug: string; title: string; blocks: Record<string, unknown>[]; isActive: boolean };

export default function PagesManager({ initial }: { initial: Page[] }) {
  const [pages, setPages] = useState(initial);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState('[]');
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  async function save() {
    setNotice(null);
    try {
      const parsed = JSON.parse(blocks);
      const res = await savePageAction({ slug, title, blocks: parsed, isActive: true });
      if (!res.ok) { setNotice({ text: res.error.message, tone: 'error' }); return; }
      setPages((p) => [...p.filter((x) => x.slug !== slug), res.data.page]);
      const storefrontNote = res.data.storefront.ok ? '' : ` Storefront refresh failed: ${res.data.storefront.reason}`;
      setNotice({ text: `Saved ${slug}.${storefrontNote}`, tone: res.data.storefront.ok ? 'success' : 'error' });
    } catch {
      setNotice({ text: 'Blocks must be valid JSON.', tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CMS Pages"
        subtitle="Static storefront pages and their content blocks."
        actions={<Button variant="primary" size="md" disabled={!slug || !title} onClick={() => void save()}>Save page</Button>}
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
          <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="about" required />
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div className="md:col-span-2">
            <Textarea label="Blocks (JSON)" rows={8} value={blocks} onChange={(e) => setBlocks(e.target.value)} className="font-mono" />
          </div>
        </div>
      </ContentCard>

      {pages.length === 0 ? (
        <EmptyState title="No CMS pages yet" description="Saved pages will appear here." />
      ) : (
        <ContentCard padding="0px">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Page</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={p.id} hoverable={false}>
                  <TableCell>{p.title}</TableCell>
                  <TableCell style={MONO_ID_STYLE}>/{p.slug}</TableCell>
                  <TableCell><Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell>
                    <Button variant="secondary" size="sm" onClick={() => { setSlug(p.slug); setTitle(p.title); setBlocks(JSON.stringify(p.blocks, null, 2)); }}>Edit</Button>
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
