'use client';

import { useState } from 'react';
import type { MobileNavItem } from '@tuw/heart/modules/content';
import { Button, Input, PageHeader } from '@/components/ui';
import { saveMobileNavAction } from '@/server/content-actions';

const emptyItem = (): MobileNavItem => ({ label: '', href: '', columns: [] });

export default function NavigationManager({ initial }: { initial: MobileNavItem[] }) {
  const [items, setItems] = useState<MobileNavItem[]>(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateItem(index: number, patch: Partial<MobileNavItem>) {
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((list) => [...list, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((list) => list.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((list) => {
      const next = [...list];
      const target = index + direction;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function addColumn(itemIndex: number) {
    setItems((list) => list.map((item, i) =>
      i === itemIndex
        ? { ...item, columns: [...(item.columns ?? []), { title: '', links: [] }] }
        : item));
  }

  function updateColumn(itemIndex: number, columnIndex: number, title: string) {
    setItems((list) => list.map((item, i) => i === itemIndex
      ? { ...item, columns: (item.columns ?? []).map((col, c) => (c === columnIndex ? { ...col, title } : col)) }
      : item));
  }

  function removeColumn(itemIndex: number, columnIndex: number) {
    setItems((list) => list.map((item, i) => i === itemIndex
      ? { ...item, columns: (item.columns ?? []).filter((_, c) => c !== columnIndex) }
      : item));
  }

  function addLink(itemIndex: number, columnIndex: number) {
    setItems((list) => list.map((item, i) => i === itemIndex
      ? {
          ...item,
          columns: (item.columns ?? []).map((col, c) => c === columnIndex
            ? { ...col, links: [...col.links, { label: '', href: '' }] }
            : col),
        }
      : item));
  }

  function updateLink(itemIndex: number, columnIndex: number, linkIndex: number, patch: { label?: string; href?: string }) {
    setItems((list) => list.map((item, i) => i === itemIndex
      ? {
          ...item,
          columns: (item.columns ?? []).map((col, c) => c === columnIndex
            ? { ...col, links: col.links.map((link, l) => (l === linkIndex ? { ...link, ...patch } : link)) }
            : col),
        }
      : item));
  }

  function removeLink(itemIndex: number, columnIndex: number, linkIndex: number) {
    setItems((list) => list.map((item, i) => i === itemIndex
      ? {
          ...item,
          columns: (item.columns ?? []).map((col, c) => c === columnIndex
            ? { ...col, links: col.links.filter((_, l) => l !== linkIndex) }
            : col),
        }
      : item));
  }

  async function save() {
    if (!items.every((item) => item.label.trim() && item.href.trim())) {
      setNotice('Every menu item needs a label and a link.');
      return;
    }
    setBusy(true);
    setNotice(null);
    const result = await saveMobileNavAction({ items });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error.message);
      return;
    }
    const refreshNote = result.data.storefront.ok
      ? ''
      : ` Storefront refresh failed: ${result.data.storefront.reason}`;
    setNotice(`Mobile navigation saved.${refreshNote}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Navigation"
        subtitle="Phone and tablet drawer menu. Desktop mega-menu is unchanged."
        actions={
          <Button variant="primary" size="md" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save navigation'}
          </Button>
        }
      />
      {notice && <p role="status" className="text-sm">{notice}</p>}

      <div className="flex flex-col gap-4">
        {items.map((item, itemIndex) => (
          <section
            key={`${itemIndex}-${item.label}`}
            style={{
              padding: 16,
              border: '1px solid var(--tuw-border-subtle, #E2E4E6)',
              borderRadius: 12,
              background: 'var(--tuw-bg-surface, #FFFFFF)',
            }}
          >
            <div className="flex flex-wrap items-end gap-3">
              <div style={{ flex: '1 1 220px' }}>
                <Input label="Menu label" value={item.label} onChange={(e) => updateItem(itemIndex, { label: e.target.value })} required />
              </div>
              <div style={{ flex: '2 1 320px' }}>
                <Input label="Link" value={item.href} onChange={(e) => updateItem(itemIndex, { href: e.target.value })} required />
              </div>
              <Button variant="secondary" size="sm" disabled={itemIndex === 0} onClick={() => moveItem(itemIndex, -1)}>Up</Button>
              <Button variant="secondary" size="sm" disabled={itemIndex === items.length - 1} onClick={() => moveItem(itemIndex, 1)}>Down</Button>
              <Button variant="secondary" size="sm" onClick={() => removeItem(itemIndex)}>Remove</Button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {(item.columns ?? []).map((column, columnIndex) => (
                <div key={columnIndex} style={{ paddingLeft: 16, borderLeft: '2px solid var(--tuw-border-subtle, #E2E4E6)' }}>
                  <div className="flex flex-wrap items-end gap-3">
                    <div style={{ flex: '1 1 220px' }}>
                      <Input label="Column title" value={column.title} onChange={(e) => updateColumn(itemIndex, columnIndex, e.target.value)} required />
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => removeColumn(itemIndex, columnIndex)}>Remove column</Button>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {column.links.map((link, linkIndex) => (
                      <div key={linkIndex} className="flex flex-wrap items-end gap-3">
                        <div style={{ flex: '1 1 180px' }}>
                          <Input label="Link label" value={link.label} onChange={(e) => updateLink(itemIndex, columnIndex, linkIndex, { label: e.target.value })} required />
                        </div>
                        <div style={{ flex: '2 1 280px' }}>
                          <Input label="Link URL" value={link.href} onChange={(e) => updateLink(itemIndex, columnIndex, linkIndex, { href: e.target.value })} required />
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => removeLink(itemIndex, columnIndex, linkIndex)}>Remove</Button>
                      </div>
                    ))}
                    <Button variant="secondary" size="sm" onClick={() => addLink(itemIndex, columnIndex)}>Add link</Button>
                  </div>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => addColumn(itemIndex)}>Add column</Button>
            </div>
          </section>
        ))}

        <Button variant="secondary" size="md" onClick={addItem}>Add menu item</Button>
      </div>
    </div>
  );
}
