'use client';

import React from 'react';
import { listNotificationsAction, markAllNotificationsReadAction, markNotificationReadAction } from '@/server/notification-actions';
import type { Notification, RemoteReadState } from './types';
import { categoryForKind, timeAgo, toneForKind } from '@/lib/notifications';

const PREFIX = 'db:';


export function useStaffAlerts(open: boolean): { items: Notification[]; remote: RemoteReadState } {
  const [items, setItems] = React.useState<Notification[]>([]);
  const [readIds, setReadIds] = React.useState<ReadonlySet<string>>(new Set());
  const initialFetchDone = React.useRef(false);

  React.useEffect(() => {
    if (initialFetchDone.current && !open) return;
    initialFetchDone.current = true;
    let live = true;
    void listNotificationsAction({}).then((result) => {
      if (!live || !result.ok) return;
      setItems(result.data.map((n) => ({
        id: `${PREFIX}${n.id}`,
        category: categoryForKind(n.kind),
        tone: toneForKind(n.kind, n.dedupeKey),
        title: n.title,
        body: n.body,
        time: timeAgo(n.createdAt),
        ...(n.link ? { href: n.link } : {}),
      })));
      setReadIds(new Set(result.data.filter((n) => n.read).map((n) => `${PREFIX}${n.id}`)));
    });
    return () => { live = false; };
  }, [open]);

  const remote: RemoteReadState = {
    readIds,
    markRead: async (id) => {
      if (!id.startsWith(PREFIX)) return;
      const result = await markNotificationReadAction({ id: id.slice(PREFIX.length) });
      if (!result.ok) throw new Error(result.error.message);
    },
    markAllRead: async () => {
      const result = await markAllNotificationsReadAction({});
      if (!result.ok) throw new Error(result.error.message);
    },
  };
  return { items, remote };
}
