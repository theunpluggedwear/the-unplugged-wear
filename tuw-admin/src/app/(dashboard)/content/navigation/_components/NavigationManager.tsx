'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DesktopNavItem, MobileNavItem } from '@tuw/heart/modules/content';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Monitor,
  Plus,
  Search,
  Smartphone,
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
  Tabs,
} from '@/components/ui';
import { saveDesktopNavAction, saveMobileNavAction } from '@/server/content-actions';
import {
  NAV_CAPS,
  getAtPath,
  moveWithinArray,
  patchAtPath,
  toRows,
  visibleRows,
  type MatrixRow,
  type NavMode,
  type Path,
} from '@/lib/navigation-matrix';

type Notice = { tone: 'success' | 'error'; text: string };

const KIND_LABEL: Record<MatrixRow['kind'], string> = {
  item: 'Item',
  column: 'Column',
  link: 'Link',
  feature: 'Feature',
  shopAll: 'Shop all',
};

function EditableCell({
  id,
  value,
  onCommit,
  max = 100,
  placeholder = 'Not set',
}: {
  id: string;
  value: string;
  onCommit: (value: string) => void;
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

  if (!editing) {
    return (
      <button
        type="button"
        onClick={begin}
        aria-label={`Edit ${id}`}
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
    );
  }

  return (
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

export default function NavigationManager({
  mobile,
  desktop,
}: {
  mobile: MobileNavItem[];
  desktop: DesktopNavItem[];
}) {
  const [mode, setMode] = useState<NavMode>('mobile');
  const [mobileItems, setMobileItems] = useState<MobileNavItem[]>(mobile);
  const [desktopItems, setDesktopItems] = useState<DesktopNavItem[]>(desktop);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState<Record<NavMode, boolean>>({ mobile: false, desktop: false });

  const items = mode === 'mobile' ? mobileItems : desktopItems;
  const caps = NAV_CAPS[mode];
  const rows = useMemo(() => toRows(items as Parameters<typeof toRows>[0], mode), [items, mode]);
  const result = useMemo(() => visibleRows(rows, query, collapsed), [rows, query, collapsed]);
  const isSearching = Boolean(query.trim());

  function markDirty() {
    setDirty((current) => ({ ...current, [mode]: true }));
    setConfirmId(null);
  }

  function updateAt(path: Path, update: (current: unknown) => unknown) {
    if (mode === 'mobile') {
      setMobileItems((current) => patchAtPath(current, path, update) as MobileNavItem[]);
    } else {
      setDesktopItems((current) => patchAtPath(current, path, update) as DesktopNavItem[]);
    }
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
    if (mode === 'mobile') {
      setMobileItems((current) => [...current, { label: '', href: '', columns: [] }]);
    } else {
      setDesktopItems((current) => [...current, { label: '', href: '', columns: [], features: [] }]);
    }
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

  function switchMode(next: NavMode) {
    setMode(next);
    setQuery('');
    setCollapsed(new Set());
    setConfirmId(null);
    setNotice(null);
  }

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const saved = mode === 'mobile'
        ? await saveMobileNavAction({ items: mobileItems })
        : await saveDesktopNavAction({ items: desktopItems });
      if (!saved.ok) {
        setNotice({ tone: 'error', text: saved.error.message });
        return;
      }
      const refreshNote = saved.data.storefront.ok
        ? ''
        : ` Storefront refresh failed: ${saved.data.storefront.reason}`;
      const headline = mode === 'mobile'
        ? 'Mobile navigation saved.'
        : 'Desktop menu saved as a draft — the storefront still uses its built-in menu.';
      setNotice({ tone: saved.data.storefront.ok ? 'success' : 'error', text: headline + refreshNote });
      setDirty((current) => ({ ...current, [mode]: false }));
    } finally {
      setBusy(false);
    }
  }

  const confirming = (row: MatrixRow) => confirmId === row.id;

  function renderActions(row: MatrixRow) {
    if (confirming(row)) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Button variant="danger" size="sm" onClick={() => remove(row)}>Confirm remove</Button>
          <IconButton label="Cancel remove" icon={<X size={14} />} size="sm" onClick={() => setConfirmId(null)} />
        </div>
      );
    }
    const canMove = row.kind !== 'shopAll';
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {row.kind === 'item' && row.capacity && row.capacity.used < caps.columns ? (
          <IconButton
            label={`Add column to ${row.label || 'item'}`}
            icon={<Plus size={14} />}
            size="sm"
            onClick={() => addColumn(row.siblingIndex)}
          />
        ) : null}
        {row.kind === 'column' && row.capacity && row.capacity.used < caps.links ? (
          <IconButton
            label={`Add link to ${row.label || 'column'}`}
            icon={<Plus size={14} />}
            size="sm"
            onClick={() => addLink(Number(row.path[0]), row.siblingIndex)}
          />
        ) : null}
        {mode === 'desktop' && row.kind === 'item' && (getAtPath(items, [row.siblingIndex, 'features']) as unknown[] | undefined)?.length !== caps.features ? (
          <IconButton
            label={`Add feature tile to ${row.label || 'item'}`}
            icon={<Plus size={14} />}
            size="sm"
            onClick={() => addFeature(row.siblingIndex)}
          />
        ) : null}
        {mode === 'desktop' && row.kind === 'item' && !getAtPath(items, [row.siblingIndex, 'shopAll']) ? (
          <IconButton
            label={`Add shop-all link to ${row.label || 'item'}`}
            icon={<Plus size={14} />}
            size="sm"
            onClick={() => addShopAll(row.siblingIndex)}
          />
        ) : null}
        {canMove ? (
          <IconButton
            label={`Move ${KIND_LABEL[row.kind].toLowerCase()} up`}
            icon={<ArrowUp size={14} />}
            size="sm"
            disabled={row.siblingIndex === 0}
            onClick={() => move(row, -1)}
          />
        ) : null}
        {canMove ? (
          <IconButton
            label={`Move ${KIND_LABEL[row.kind].toLowerCase()} down`}
            icon={<ArrowDown size={14} />}
            size="sm"
            disabled={row.siblingIndex === row.siblingCount - 1}
            onClick={() => move(row, 1)}
          />
        ) : null}
        <IconButton
          label={`Remove ${KIND_LABEL[row.kind].toLowerCase()} ${row.label || ''}`.trim()}
          icon={<Trash2 size={14} />}
          variant="danger"
          size="sm"
          onClick={() => setConfirmId(row.id)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Navigation"
        subtitle={`Phone, tablet and desktop mega-menu. Saved to the CMS — ${dirty[mode] ? 'unsaved changes' : 'up to date'}.`}
        actions={
          <Button variant="primary" size="md" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save navigation'}
          </Button>
        }
      />

      <Tabs
        ariaLabel="Navigation target"
        activeTab={mode}
        onChange={(id) => switchMode(id as NavMode)}
        tabs={[
          { id: 'mobile', label: 'Mobile & tablet', icon: <Smartphone size={15} />, badge: mobileItems.length },
          { id: 'desktop', label: 'Desktop mega-menu', icon: <Monitor size={15} />, badge: desktopItems.length },
        ]}
      />

      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          style={{ fontSize: 13, color: notice.tone === 'error' ? 'var(--tuw-text-error, #C91818)' : 'var(--tuw-text-success, #187343)' }}
        >
          {notice.text}
        </p>
      ) : null}

      {mode === 'desktop' ? (
        <ContentCard>
          <div style={{ fontSize: 13, color: 'var(--tuw-text-warning, #856300)', lineHeight: 20 }}>
            Draft editor. Desktop edits are stored in the CMS but the storefront still renders its built-in menu;
            wiring the storefront to read this document is a separate task. Shop filters and image-tile fields are
            preserved on save and are not edited in this table.
          </div>
        </ContentCard>
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
          <Button
            variant="ghost"
            size="sm"
            disabled={isSearching}
            onClick={() => setCollapsed(new Set(rows.filter((row) => row.hasChildren).map((row) => row.id)))}
          >
            Collapse all
          </Button>
          <Button variant="ghost" size="sm" disabled={isSearching} onClick={() => setCollapsed(new Set())}>
            Expand all
          </Button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title={mode === 'mobile' ? 'No mobile menu items' : 'No desktop menu items'}
            description={mode === 'mobile'
              ? 'Add items to build the phone and tablet drawer menu.'
              : 'Add items to draft the desktop mega-menu.'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead style={{ width: '30%' }}>Item / column / link</TableHead>
                <TableHead style={{ width: '27%' }}>Label</TableHead>
                <TableHead style={{ width: '25%' }}>Link / URL</TableHead>
                <TableHead style={{ width: '18%' }}>Capacity</TableHead>
                <TableHead style={{ width: 210 }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {Array.from({ length: row.depth }, (_, level) => (
                        <span
                          key={level}
                          aria-hidden="true"
                          style={{
                            display: 'inline-block',
                            width: 16,
                            height: 20,
                            borderLeft: '2px solid var(--tuw-border-subtle, #E9E9E9)',
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
                  <TableCell>
                    <EditableCell
                      id={`${mode}-${row.id}-label`}
                      value={row.label}
                      onCommit={(value) => editField(row, 'label', value)}
                      max={row.kind === 'feature' ? 200 : 100}
                      placeholder={row.kind === 'feature' ? 'Feature title' : 'Label'}
                    />
                    {row.meta ? (
                      <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', marginTop: 2 }}>
                        {row.meta}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.kind === 'column' ? (
                      <span style={{ color: 'var(--tuw-text-secondary, #5D6772)' }}>—</span>
                    ) : (
                      <EditableCell
                        id={`${mode}-${row.id}-href`}
                        value={row.href}
                        onCommit={(value) => editField(row, 'href', value)}
                        max={500}
                        placeholder="URL"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {row.capacity ? (
                      <CapacityBar used={row.capacity.used} max={row.capacity.max} noun={row.capacity.noun} />
                    ) : (
                      <span style={{ color: 'var(--tuw-text-secondary, #5D6772)' }}>—</span>
                    )}
                  </TableCell>
                  <TableCell>{renderActions(row)}</TableCell>
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
