export const instant = false;
import React from 'react';
import { listNotifications, NOTIFICATION_RETENTION_DAYS } from '@tuw/heart/modules/notifications';
import { session } from '@/server/session';
import NotificationsView from './_components/NotificationsView';

export default async function NotificationsPage() {
  const claims = await session.requireStaff('product.update', '/notifications');
  const items = await listNotifications(claims.sub, 200);
  return <NotificationsView items={items} retentionDays={NOTIFICATION_RETENTION_DAYS} />;
}
