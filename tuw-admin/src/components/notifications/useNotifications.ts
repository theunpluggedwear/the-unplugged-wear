'use client';

import React from 'react';
import type { Notification, NotificationRepository, RemoteReadState } from './types';



export function useNotifications(source: Notification[], remote?: RemoteReadState): NotificationRepository {
  const [readIds, setReadIds] = React.useState<ReadonlySet<string>>(new Set());

  const isRead = (id: string) => readIds.has(id) || Boolean(remote?.readIds.has(id));
  const unreadCount = source.filter((n) => !isRead(n.id)).length;

  React.useEffect(() => {
    if (remote) setReadIds(new Set(remote.readIds));
  }, [remote?.readIds]);

  return {
    all: source,
    unreadCount,
    isRead,
    markRead: async (id: string) => {
      if (isRead(id)) return;
      if (remote) await remote.markRead(id);
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    markAllRead: async () => {
      if (remote) await remote.markAllRead();
      setReadIds(new Set(source.map((n) => n.id)));
    },
  };
}
