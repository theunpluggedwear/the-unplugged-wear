'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MenuItem } from '@tuw/heart/modules/content';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  ContentCard,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { saveMenuAction } from '@/server/content-actions';
import {
  NAV_CAPS,
  getAtPath,
  moveWithinArray,
  patchAtPath,
  toRows,
  visibleRows,
  type MatrixRow,
  type Path,
} from '@/lib/navigation-matrix';

type Notice = { tone: 'success' | 'error'; text: string };

const KIND_LABEL: Record<MatrixRow['kind'], string> = {
  item: 'Menu item',
  column: 'Column',
  link: 'Link',
  feature: 'Feature tile',
  shopAll: 'Shop all',
};

const FIELD_TEXT: Record<MatrixRow['kind'], { name: string; nameHint: string; link: string; linkHint: string }> = {
  item: { name: 'Menu name', nameHint: 'Shown in both the drawer and the header', link: 'Menu link', linkHint: 'Where this item goes' },
  column: { name: 'Column heading', nameHint: 'Groups the links beneath it', link: 'No link', linkHint: 'A group has no destination' },
  link: { name: 'Link text', nameHint: 'What customers click', link: 'Destination', linkHint: 'Page or shop URL' },
  feature: { name: 'Feature title', nameHint: 'Title of the image card', link: 'Image link', linkHint: 'Where the tile goes' },
  shopAll: { name: 'Shop-all text', nameHint: 'Link at the foot of the panel', link: 'Shop-all link', linkHint: 'Where the footer link goes' },
};

function EditableCell({
  id,
  value,
  onCommit,
  fieldLabel,
  hint,
  max = 100,
  placeholder = 'Not set',
}: {
  id: string;
  value: string;
  onCommit: (value: string) => void;
  fieldLabel: string;
  hint?: string;
  max?: number;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function begin() {
    cancelled.current = false;
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function commit() {
    if (cancelled.current) return;
    const next = draft.trim();
    if (!next) { setError('This field is required.'); return; }
    if (next.length > max) { setError(`Use ${max} characters or fewer.`); return; }
    onCommit(next);
    setEditing(false);
    setError(null);
  }

  function cancel() {
    cancelled.current = true;
    setEditing(false);
    setError(null);
  }

  const caption = (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tuw-text-secondary, #5D6772)' }}>
      {fieldLabel}
    </div>
  );
  const helper = hint ? (
    <div style={{ fontSize: 11, lineHeight: 16, color: 'var(--tuw-text-secondary, #5D6772)' }}>{hint}</div>
  ) : null;

  if (!editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {caption}
        <button
          type="button"
          onClick={begin}
          aria-label={`Edit ${fieldLabel} (${id})`}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '6px 2px',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px dashed var(--tuw-border-control, #D1D5DB)',
            fontFamily: 'var(--font-main)',
            fontSize: '14px',
            lineHeight: '22px',
            color: value ? 'var(--tuw-text-primary, #262626)' : 'var(--tuw-text-secondary, #5D6772)',
            cursor: 'pointer',
          }}
        >
          {value || placeholder}
        </button>
        {helper}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      {caption}
      <Input
        id={`cell-${id}`}
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commit(); }
          if (event.key === 'Escape') { event.preventDefault(); cancel(); }
        }}
        onBlur={commit}
        error={error ?? undefined}
        fullWidth
      />
      {helper}
    </div>
  );
}

function CapacityBar({ used, max, noun }: { used: number; max: number; noun: string }) {
  const percent = max === 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  const colour = used >= max
    ? 'var(--tuw-text-error, #C91818)'
    : percent >= 80
      ? 'var(--tuw-text-warning, #856300)'
      : 'var(--tuw-action-primary, #7539FF)';
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', whiteSpace: 'nowrap' }}>
        {used} / {max} {noun}
      </div>
      <div
        role="progressbar"
        aria-label={`${noun} used`}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={max}
        style={{
          height: 6,
          marginTop: 4,
          borderRadius: 3,
          background: 'var(--tuw-bg-canvas, #F7F8F9)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${percent}%`, height: '100%', background: colour }} />
      </div>
    </div>
  );
}

export default function NavigationManager({ items: initial }: { items: MenuItem[] }) {
  const [items, setItems] = useState<MenuItem[]>(initial);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const caps = NAV_CAPS;
  const rows = useMemo(() => toRows(items), [items]);
  const result = useMemo(() => visibleRows(rows, query, collapsed), [rows, query, collapsed]);
  const isSearching = Boolean(query.trim());

  function markDirty() {
    setDirty(true);
    setConfirmId(null);
  }

  function updateAt(path: Path, update: (current: unknown) => unknown) {
    setItems((current) => patchAtPath(current, path, update) as MenuItem[]);
    markDirty();
  }

  function editField(row: MatrixRow, field: 'label' | 'href', value: string) {
    if (row.kind === 'link' || row.kind === 'item' || row.kind === 'shopAll') {
      updateAt(row.path, (current) => ({ ...(current as object), [field]: value }));
    } else if (field === 'label') {
      updateAt(row.path, (current) => ({ ...(current as object), title: value }));
    } else {
      updateAt(row.path, (current) => ({ ...(current as object), href: value }));
    }
  }

  function addItem() {
    setItems((current) => [...current, { label: '', href: '', columns: [], features: [] }]);
    markDirty();
  }

  function addColumn(itemIndex: number) {
    updateAt([itemIndex, 'columns'], (current) => [
      ...((current as { title: string; links: unknown[] }[] | undefined) ?? []),
      { title: '', links: [] },
    ]);
  }

  function addLink(itemIndex: number, columnIndex: number) {
    updateAt([itemIndex, 'columns', columnIndex, 'links'], (current) => [
      ...((current as unknown[] | undefined) ?? []),
      { label: '', href: '' },
    ]);
  }

  function addFeature(itemIndex: number) {
    updateAt([itemIndex, 'features'], (current) => [
      ...((current as unknown[] | undefined) ?? []),
      { title: '', href: '' },
    ]);
  }

  function addShopAll(itemIndex: number) {
    updateAt([itemIndex], (current) => ({ ...(current as object), shopAll: { label: '', href: '' } }));
  }

  function move(row: MatrixRow, direction: -1 | 1) {
    updateAt(row.arrayPath, (current) =>
      moveWithinArray((current as unknown[] | undefined) ?? [], row.siblingIndex, direction));
  }

  function remove(row: MatrixRow) {
    if (row.kind === 'shopAll') {
      updateAt([Number(row.path[0])], (current) => {
        const next = { ...(current as Record<string, unknown>) };
        delete next.shopAll;
        return next;
      });
      return;
    }
    updateAt(row.arrayPath, (current) =>
      ((current as unknown[] | undefined) ?? []).filter((_, index) => index !== row.siblingIndex));
  }

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const saved = await saveMenuAction({ items });
      if (!saved.ok) {
        setNotice({ tone: 'error', text: saved.error.message });
        return;
      }
      const refreshNote = saved.data.storefront.ok
        ? ''
        : ` Storefront refresh failed: ${saved.data.storefront.reason}`;
      setNotice({
        tone: saved.data.storefront.ok ? 'success' : 'error',
        text: 'Menu saved as a draft — the storefront still uses its built-in menu.' + refreshNote,
      });
      setDirty(false);
    } finally {
      setBusy(false);
    }
  }

  function renderActions(row: MatrixRow) {
    if (confirmId === row.id) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Button variant="danger" size="sm" onClick={() => remove(row)}>Confirm remove</Button>
          <IconButton label="Cancel remove" icon={<X size={14} />} size="sm" onClick={() => setConfirmId(null)} />
        </div>
      );
    }
    const canMove = row.kind !== 'shopAll';
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {row.kind === 'item' && row.capacity && row.capacity.used < caps.columns ? (
          <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => addColumn(row.siblingIndex)}>
            Column
          </Button>
        ) : null}
        {row.kind === 'column' && row.capacity && row.capacity.used < caps.links ? (
          <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => addLink(Number(row.path[0]), row.siblingIndex)}>
            Link
          </Button>
        ) : null}
        {row.kind === 'item' && (getAtPath(items, [row.siblingIndex, 'features']) as unknown[] | undefined)?.length !== caps.features ? (
          <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => addFeature(row.siblingIndex)}>
            Feature
          </Button>
        ) : null}
        {row.kind === 'item' && !getAtPath(items, [row.siblingIndex, 'shopAll']) ? (
          <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => addShopAll(row.siblingIndex)}>
            Shop all
          </Button>
        ) : null}
        {canMove ? (
          <IconButton label={`Move ${KIND_LABEL[row.kind].toLowerCase()} up`} tooltip="Move up" icon={<ArrowUp size={14} />} size="sm" disabled={row.siblingIndex === 0} onClick={() => move(row, -1)} />
        ) : null}
        {canMove ? (
          <IconButton label={`Move ${KIND_LABEL[row.kind].toLowerCase()} down`} tooltip="Move down" icon={<ArrowDown size={14} />} size="sm" disabled={row.siblingIndex === row.siblingCount - 1} onClick={() => move(row, 1)} />
        ) : null}
        <IconButton label={`Remove ${KIND_LABEL[row.kind].toLowerCase()} ${row.label || ''}`.trim()} tooltip="Remove" icon={<Trash2 size={14} />} variant="danger" size="sm" onClick={() => setConfirmId(row.id)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Navigation"
        subtitle={`One menu for the phone drawer and the desktop header. Saved to the CMS — ${dirty ? 'unsaved changes' : 'up to date'}.`}
        actions={
          <Button variant="primary" size="md" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save navigation'}
          </Button>
        }
      />

      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          style={{ fontSize: 13, color: notice.tone === 'error' ? 'var(--tuw-text-error, #C91818)' : 'var(--tuw-text-success, #187343)' }}
        >
          {notice.text}
        </p>
      ) : null}

      <ContentCard>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ flex: '1 1 300px' }}>
            <Input
              id="nav-search"
              aria-label="Search navigation"
              placeholder="Search labels, links and all levels…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              iconPrefix={<Search size={16} />}
              fullWidth
            />
          </div>
          <Badge variant="neutral" size="md">{items.length} / {caps.items} items</Badge>
          <span style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>
            {isSearching ? `${result.matches} matches · ancestors kept` : `${rows.length} rows`}
          </span>
          <Button variant="ghost" size="sm" disabled={isSearching} onClick={() => setCollapsed(new Set(rows.filter((row) => row.hasChildren).map((row) => row.id)))}>
            Collapse all
          </Button>
          <Button variant="ghost" size="sm" disabled={isSearching} onClick={() => setCollapsed(new Set())}>
            Expand all
          </Button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="No menu items"
            description="Add items to build the menu shown in the phone drawer and the desktop header."
          />
        ) : (
          <Table style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
            <TableHeader style={{ background: 'transparent', borderBottom: 'none' }}>
              <TableRow hoverable={false}>
                <TableHead style={{ width: '28%', background: 'var(--tuw-bg-selected, #F8F5FF)', borderTopLeftRadius: 'var(--radius-nav, 10px)', borderBottomLeftRadius: 'var(--radius-nav, 10px)' }}>Structure</TableHead>
                <TableHead style={{ width: '27%', background: 'var(--tuw-bg-selected, #F8F5FF)' }}>Name</TableHead>
                <TableHead style={{ width: '23%', background: 'var(--tuw-bg-selected, #F8F5FF)' }}>Link</TableHead>
                <TableHead style={{ width: '14%', background: 'var(--tuw-bg-selected, #F8F5FF)' }}>Capacity</TableHead>
                <TableHead style={{ width: 200, background: 'var(--tuw-bg-selected, #F8F5FF)', borderTopRightRadius: 'var(--radius-nav, 10px)', borderBottomRightRadius: 'var(--radius-nav, 10px)' }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.id} className="tuw-nav-matrix-row">
                  <TableCell style={{ padding: '10px 12px 10px 16px', borderTopLeftRadius: 'var(--radius-nav, 10px)', borderBottomLeftRadius: 'var(--radius-nav, 10px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {Array.from({ length: row.depth }, (_, level) => (
                        <span
                          key={level}
                          aria-hidden="true"
                          style={{
                            display: 'inline-block',
                            width: 14,
                            height: 26,
                            flexShrink: 0,
                            borderLeft: '1px solid var(--color-nav-guide, #DDDDDD)',
                            borderBottom: '1px solid var(--color-nav-guide, #DDDDDD)',
                            borderBottomLeftRadius: 'var(--radius-nav, 10px)',
                          }}
                        />
                      ))}
                      {row.hasChildren ? (
                        <button
                          type="button"
                          aria-label={`${collapsed.has(row.id) ? 'Expand' : 'Collapse'} ${row.label || KIND_LABEL[row.kind]}`}
                          aria-expanded={!collapsed.has(row.id)}
                          onClick={() => setCollapsed((current) => {
                            const next = new Set(current);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', padding: 2 }}
                        >
                          {collapsed.has(row.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                      ) : (
                        <span style={{ display: 'inline-block', width: 18 }} />
                      )}
                      <Badge variant={row.kind === 'item' ? 'info' : 'neutral'} size="sm">
                        {KIND_LABEL[row.kind]}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell style={{ padding: '10px 12px' }}>
                    <EditableCell
                      id={`menu-${row.id}-label`}
                      value={row.label}
                      onCommit={(value) => editField(row, 'label', value)}
                      fieldLabel={FIELD_TEXT[row.kind].name}
                      hint={[FIELD_TEXT[row.kind].nameHint, row.meta].filter(Boolean).join(' · ')}
                      max={row.kind === 'feature' ? 200 : 100}
                      placeholder={row.kind === 'feature' ? 'e.g. Summer essentials' : row.kind === 'column' ? 'e.g. Clothing' : row.kind === 'shopAll' ? 'e.g. Shop all men' : 'e.g. Shop'}
                    />
                  </TableCell>
                  <TableCell style={{ padding: '10px 12px' }}>
                    {row.kind === 'column' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                          {FIELD_TEXT[row.kind].link}
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--tuw-text-secondary, #5D6772)' }}>A group — no destination</div>
                        <div style={{ fontSize: 11, color: 'var(--tuw-text-secondary, #5D6772)' }}>{FIELD_TEXT[row.kind].linkHint}</div>
                      </div>
                    ) : (
                      <EditableCell
                        id={`menu-${row.id}-href`}
                        value={row.href}
                        onCommit={(value) => editField(row, 'href', value)}
                        fieldLabel={FIELD_TEXT[row.kind].link}
                        hint={FIELD_TEXT[row.kind].linkHint}
                        max={500}
                        placeholder="e.g. /shop"
                      />
                    )}
                  </TableCell>
                  <TableCell style={{ padding: '10px 12px' }}>
                    {row.capacity ? (
                      <CapacityBar used={row.capacity.used} max={row.capacity.max} noun={row.capacity.noun} />
                    ) : (
                      <span style={{ color: 'var(--tuw-text-secondary, #5D6772)' }}>—</span>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: '10px 12px', borderTopRightRadius: 'var(--radius-nav, 10px)', borderBottomRightRadius: 'var(--radius-nav, 10px)' }}>
                    {renderActions(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" size="md" disabled={items.length >= caps.items} onClick={addItem}>
            <Plus size={15} /> Add menu item
          </Button>
          {items.length >= caps.items ? (
            <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>
              Limit of {caps.items} items reached
            </span>
          ) : null}
        </div>
      </ContentCard>
    </div>
  );
}
