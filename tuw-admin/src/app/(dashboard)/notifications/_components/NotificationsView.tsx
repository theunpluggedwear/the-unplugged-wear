'use client';

import React from 'react';
import type { NotificationDto } from '@tuw/heart/modules/notifications';
import {
  Badge,
  Button,
  ContentCard,
  EmptyState,
  FilterPills,
  IconButton,
  LinkButton,
  PageHeader,
  Pagination,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { Check, ExternalLink } from 'lucide-react';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/server/notification-actions';
import { categoryForKind, timeAgo, toneForKind } from '@/lib/notifications';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'orders', label: 'Order & Sales' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'payment', label: 'Payment' },
  { value: 'system', label: 'System' },
  { value: 'marketing', label: 'Marketing' },
] as const;

const TONE_VARIANT = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
} as const;

export default function NotificationsView({
  items,
  retentionDays,
}: {
  items: NotificationDto[];
  retentionDays: number;
}) {
  const [rows, setRows] = React.useState(items);
  const [category, setCategory] = React.useState('all');
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [notice, setNotice] = React.useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const pageSize = 12;

  React.useEffect(() => { setRows(items); }, [items]);

  const visible = React.useMemo(() => rows.filter((row) => {
    if (unreadOnly && row.read) return false;
    if (category !== 'all' && categoryForKind(row.kind) !== category) return false;
    return true;
  }), [rows, unreadOnly, category]);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pages);
  const slice = visible.slice((safePage - 1) * pageSize, safePage * pageSize);
  const unread = rows.filter((row) => !row.read).length;

  function changeCategory(value: string) {
    setCategory(value);
    setPage(1);
  }

  async function markRead(id: string) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await markNotificationReadAction({ id });
      if (!result.ok) { setNotice({ tone: 'error', text: result.error.message }); return; }
      setRows((current) => current.map((row) => row.id === id ? { ...row, read: true } : row));
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await markAllNotificationsReadAction({});
      if (!result.ok) { setNotice({ tone: 'error', text: result.error.message }); return; }
      setRows((current) => current.map((row) => ({ ...row, read: true })));
      setNotice({ tone: 'success', text: 'All notifications marked as read.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`Your stored alerts. Rows older than ${retentionDays} days are removed automatically.`}
        actions={
          <Button variant="secondary" size="md" disabled={busy || unread === 0} onClick={() => void markAll()}>
            Mark all read
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <Badge variant={unread ? 'info' : 'success'} size="md">{unread} unread</Badge>
          <Switch
            checked={unreadOnly}
            onChange={(checked) => { setUnreadOnly(checked); setPage(1); }}
            ariaLabel="Show unread only"
            label="Unread only"
          />
          <span style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', marginLeft: 'auto' }}>
            {visible.length} of {rows.length} alerts
          </span>
        </div>

        <FilterPills
          variant="rail"
          ariaLabel="Notification categories"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={changeCategory}
        />

        <div style={{ marginTop: 16 }}>
          {slice.length === 0 ? (
            <EmptyState
              title="No notifications"
              description={unreadOnly || category !== 'all'
                ? 'Nothing matches these filters.'
                : 'Alerts from orders, stock, payments and system events will appear here.'}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Alert</TableHead>
                  <TableHead style={{ width: 140 }}>Type</TableHead>
                  <TableHead style={{ width: 110 }}>When</TableHead>
                  <TableHead style={{ width: 110 }}>Status</TableHead>
                  <TableHead style={{ width: 120 }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: row.read ? 500 : 600, color: 'var(--tuw-text-primary, #262626)' }}>
                          {row.title}
                        </span>
                        {row.body ? (
                          <span style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)' }}>{row.body}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={TONE_VARIANT[toneForKind(row.kind, row.dedupeKey)]} size="sm">
                        {CATEGORY_OPTIONS.find((option) => option.value === categoryForKind(row.kind))?.label ?? 'System'}
                      </Badge>
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                      {timeAgo(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.read ? 'neutral' : 'info'} size="sm">{row.read ? 'Read' : 'Unread'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <IconButton
                          label={`Mark ${row.title} as read`}
                          tooltip="Mark as read"
                          icon={<Check size={14} />}
                          size="sm"
                          disabled={row.read || busy}
                          onClick={() => void markRead(row.id)}
                        />
                        {row.link ? (
                          <LinkButton href={row.link} variant="ghost" size="sm" icon={<ExternalLink size={14} />} title="Open linked page">
                            Open
                          </LinkButton>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <Pagination
          currentPage={safePage}
          totalPages={pages}
          onPageChange={setPage}
          totalItems={visible.length}
          pageSize={pageSize}
        />
      </ContentCard>
    </div>
  );
}
