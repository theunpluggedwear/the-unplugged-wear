import type { NotificationCategory, NotificationTone } from '@/components/notifications/types';

const KIND_CATEGORY: Record<string, NotificationCategory> = {
  order: 'orders',
  cart: 'orders',
  inventory: 'inventory',
  payment: 'payment',
  refund: 'payment',
  system: 'system',
  marketing: 'marketing',
};

const KIND_TONE: Record<string, NotificationTone> = {
  order: 'info',
  cart: 'warning',
  inventory: 'warning',
  payment: 'error',
  refund: 'error',
  system: 'info',
  marketing: 'info',
};

export function categoryForKind(kind: string): NotificationCategory {
  return KIND_CATEGORY[kind] ?? 'system';
}

export function toneForKind(kind: string, dedupeKey?: string | null): NotificationTone {
  return dedupeKey?.startsWith('inventory.out') ? 'error' : (KIND_TONE[kind] ?? 'info');
}

export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} d`;
}
