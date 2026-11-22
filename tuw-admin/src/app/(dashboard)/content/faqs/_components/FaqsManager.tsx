'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
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
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

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
    if (!res.ok) { setNotice({ text: res.error.message, tone: 'error' }); return; }
    setFaqs((list) => [res.data.faq, ...list.filter((f) => f.id !== res.data.faq.id)]);
    setForm({ ...empty });
    const storefrontNote = res.data.storefront.ok ? '' : ` Storefront refresh failed: ${res.data.storefront.reason}`;
    setNotice({ text: `Saved.${storefrontNote}`, tone: res.data.storefront.ok ? 'success' : 'error' });
  }

  async function remove(id: string) {
    const res = await deleteFaqAction({ id });
    if (!res.ok) { setNotice({ text: res.error.message, tone: 'error' }); return; }
    setFaqs((list) => list.filter((f) => f.id !== id));
    if (!res.data.storefront.ok) setNotice({ text: `Removed. Storefront refresh failed: ${res.data.storefront.reason}`, tone: 'error' });
    else setNotice({ text: 'FAQ removed.', tone: 'success' });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="FAQs"
        subtitle="General, product and category help entries."
        actions={<Button variant="primary" size="md" onClick={() => void save()}>{form.id ? 'Update FAQ' : 'Save FAQ'}</Button>}
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
          <Select
            label="Scope"
            value={form.scope}
            onChange={(e) => set('scope', e.target.value as Faq['scope'])}
            options={[{ value: 'general', label: 'General' }, { value: 'product', label: 'Product' }, { value: 'category', label: 'Category' }]}
          />
          {form.scope === 'product' && (
            <Select
              label="Product"
              value={form.productId}
              onChange={(e) => set('productId', e.target.value)}
              options={[{ value: '', label: 'Choose…' }, ...products.map((p) => ({ value: p.id, label: p.title }))]}
            />
          )}
          {form.scope === 'category' && (
            <Select
              label="Category"
              value={form.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
              options={[{ value: '', label: 'Choose…' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
          )}
          <Input label="Group label (general)" value={form.groupLabel} onChange={(e) => set('groupLabel', e.target.value)} />
          <Input label="Question" value={form.question} onChange={(e) => set('question', e.target.value)} required />
          <div className="md:col-span-2">
            <Textarea label="Answer" rows={4} value={form.answer} onChange={(e) => set('answer', e.target.value)} required />
          </div>
          <Input label="Sort order" type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} />
          <div className="flex items-end pb-2">
            <Checkbox label="Published" checked={form.isPublished} onChange={(e) => set('isPublished', e.target.checked)} />
          </div>
        </div>
      </ContentCard>

      {faqs.length === 0 ? (
        <EmptyState title="No FAQs yet" description="Saved help entries will appear here." />
      ) : (
        <ContentCard padding="0px">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Question</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faqs.map((f) => (
                <TableRow key={f.id} hoverable={false}>
                  <TableCell>{f.question}</TableCell>
                  <TableCell>{f.scope}</TableCell>
                  <TableCell><Badge variant={f.isPublished ? 'success' : 'neutral'}>{f.isPublished ? 'Published' : 'Draft'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => edit(f)}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => void remove(f.id)}>Delete</Button>
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
