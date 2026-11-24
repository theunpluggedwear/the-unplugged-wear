'use client';

import React from 'react';
import FilterPills from '@/components/ui/FilterPills';
import EmptyState from '@/components/ui/EmptyState';
import { NotificationItem } from './NotificationItem';
import { NOTIFICATION_CATEGORIES, type Notification, type NotificationCategory, type NotificationRepository } from './types';

interface NotificationPanelProps {
  repo: NotificationRepository;
  onNavigate: (href: string) => void;
}




export function NotificationPanel({ repo, onNavigate }: NotificationPanelProps) {
  const [category, setCategory] = React.useState<NotificationCategory>(() => {
    const firstUnread = repo.all.find((n) => !repo.isRead(n.id));
    return firstUnread ? firstUnread.category : 'orders';
  });
  const [error, setError] = React.useState<string | null>(null);
  const visible = repo.all.filter((n) => n.category === category);
  const unreadLabel = repo.unreadCount === 1 ? '1 new' : `${repo.unreadCount} new`;

  const handleOpen = async (item: Notification) => {
    setError(null);
    try {
      await repo.markRead(item.id);
      if (item.href) onNavigate(item.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark this notification as read.');
    }
  };

  const handleMarkAll = async () => {
    setError(null);
    try {
      await repo.markAllRead();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark all notifications as read.');
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        backgroundColor: 'var(--tuw-bg-surface, #FFFFFF)',
        border: '1px solid var(--tuw-border-subtle, #E5E7EB)',
        borderRadius: 'var(--tuw-radius-modal, 16px)',
        boxShadow: 'var(--shadow-popover, 0 8px 30px rgba(0, 0, 0, 0.12))',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        fontFamily: 'var(--font-main)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--tuw-text-primary, #262626)' }}>
            Notifications
          </div>
          <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--tuw-text-secondary, #5D6772)', marginTop: '2px' }}>
            {repo.unreadCount > 0 ? `You have ${unreadLabel}` : 'You are all caught up'}
          </div>
        </div>
        {repo.unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void handleMarkAll()}
            style={{
              background: 'transparent',
              border: '1px solid var(--tuw-border-subtle, #E9E9E9)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--tuw-text-primary, #262626)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: 'var(--tuw-text-error, #C91818)' }}>{error}</p>
      ) : null}

      <div className="notificationFilters">
        <FilterPills
          variant="rail"
          ariaLabel="Notification categories"
          options={NOTIFICATION_CATEGORIES.filter((c) => c.value !== 'all')}
          value={category}
          onChange={(v) => setCategory(v as NotificationCategory)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <EmptyState
            title="No notifications"
            description={`Nothing in ${NOTIFICATION_CATEGORIES.find((c) => c.value === category)?.label ?? category} right now.`}
          />
        ) : (
          visible.map((item) => (
            <NotificationItem key={item.id} item={item} read={repo.isRead(item.id)} onOpen={handleOpen} />
          ))
        )}
      </div>
    </div>
  );
}
