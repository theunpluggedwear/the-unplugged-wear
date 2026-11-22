'use client';

import React from 'react';
import type { Notification, NotificationRepository, RemoteReadState } from './types';



export function useNotifications(source: Notification[], remote?: RemoteReadState): NotificationRepository {
  const [readIds, setReadIds] = React.useState<ReadonlySet<string>>(new Set());

  const isRead = (id: string) => readIds.has(id) || Boolean(remote?.readIds.has(id));
  const unreadCount = source.filter((n) => !isRead(n.id)).length;

  return {
    all: source,
    unreadCount,
    isRead,
    markRead: (id: string) => {
      if (!isRead(id)) remote?.markRead(id);
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    markAllRead: () => {
      remote?.markAllRead();
      setReadIds(new Set(source.map((n) => n.id)));
    },
  };
}
