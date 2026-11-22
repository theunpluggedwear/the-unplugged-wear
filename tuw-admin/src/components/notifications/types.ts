export type NotificationTone = 'info' | 'success' | 'warning' | 'error';

export type NotificationCategory = 'orders' | 'inventory' | 'payment' | 'system' | 'marketing';

export interface Notification {
  id: string;
  category: NotificationCategory;
  tone: NotificationTone;
  title: string;
  body: string;
  time: string;
  href?: string;
}

export const NOTIFICATION_CATEGORIES: { value: NotificationCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'orders', label: 'Order & Sales' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'payment', label: 'Payment' },
  { value: 'system', label: 'System' },
  { value: 'marketing', label: 'Marketing' },
];





export interface RemoteReadState {
  readIds: ReadonlySet<string>;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export interface NotificationRepository {
  all: Notification[];
  unreadCount: number;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
}
