import type { LucideIcon } from 'lucide-react';
import {
  BadgePercent,
  Bell,
  ClipboardList,
  CreditCard,
  FileText,
  Headphones,
  Home as HomeIcon,
  LayoutGrid,
  Layers,
  LogOut,
  Package,
  PackageCheck,
  Palette,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Settings,
  TrendingUp,
  Truck,
  Undo2,
  Users,
} from 'lucide-react';

export interface AdminNavBadge {
  text: string;
  dotClassName: string;
  className: string;
}

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: string[];
  badge?: AdminNavBadge;
}

export interface AdminNavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  items: AdminNavItem[];
}

export interface AdminFooterItem extends AdminNavItem {
  variant: 'footer' | 'danger';
}

export const NAV_GROUPS: AdminNavGroup[] = [
  {
    key: 'core',
    label: 'Core',
    icon: LayoutGrid,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: HomeIcon, match: ['/dashboard'] },
      { href: '/orders', label: 'Orders', icon: ClipboardList, match: ['/orders'] },
      { href: '/products', label: 'Products', icon: Package, match: ['/products'] },
      { href: '/customers', label: 'Customers', icon: Users, match: ['/customers'] },
      { href: '/reports', label: 'Analytics & Reports', icon: TrendingUp, match: ['/reports', '/analytics'] },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    icon: Package,
    items: [
      { href: '/fulfillment', label: 'Fulfillment', icon: PackageCheck, match: ['/fulfillment'], badge: { text: '4', dotClassName: 'bg-action-primary', className: 'inline-flex min-w-[18px] items-center justify-center rounded-full bg-nav-badge-purple-bg px-[7.5px] py-[2.5px] text-center text-[11.5px] font-bold leading-none text-action-primary' } },
      { href: '/shipments', label: 'Shipments', icon: Truck, match: ['/shipments'] },
      { href: '/returns', label: 'Returns & RMA', icon: Undo2, match: ['/returns'] },
      { href: '/refunds', label: 'Refunds', icon: RotateCcw, match: ['/refunds'] },
      { href: '/payments', label: 'Payments', icon: CreditCard, match: ['/payments'] },
      { href: '/discounts', label: 'Discounts', icon: BadgePercent, match: ['/discounts'] },
      { href: '/abandoned', label: 'Abandoned', icon: ShoppingCart, match: ['/abandoned'] },
    ],
  },
  {
    key: 'merchandise',
    label: 'Merchandise',
    icon: ShoppingBag,
    items: [
      { href: '/collections', label: 'Collections', icon: Layers, match: ['/collections'] },
      { href: '/designs', label: 'Design Assets', icon: Palette, match: ['/designs'] },
      { href: '/content', label: 'Content CMS', icon: FileText, match: ['/content'] },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: ShieldCheck,
    items: [
      { href: '/team', label: 'Team', icon: Users, match: ['/team'] },
      { href: '/support', label: 'Support', icon: Headphones, match: ['/support'] },
      { href: '/notifications', label: 'Notifications', icon: Bell, match: ['/notifications'] },
    ],
  },
];

export const NAV_PERMISSIONS: Readonly<Record<string, string>> = {
  '/orders': 'order.view',
  '/customers': 'customer.view',
  '/reports': 'report.view',
  '/fulfillment': 'shipment.manage',
  '/shipments': 'shipment.manage',
  '/returns': 'return.view',
  '/refunds': 'order.view',
  '/payments': 'order.view',
  '/discounts': 'order.view',
  '/abandoned': 'order.view',
  '/designs': 'content.manage',
  '/content': 'content.manage',
  '/team': 'user.manage',
  '/settings': 'settings.manage',
  '/support': 'customer.view',
  '/notifications': 'product.update',
};

export const FOOTER_ITEMS: AdminFooterItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings, match: ['/settings'], variant: 'footer' },
  { href: '/support', label: 'Help & Support', icon: Headphones, match: ['/support', '/help'], variant: 'footer' },
  { href: '/login', label: 'Log out', icon: LogOut, match: [], variant: 'danger' },
];

export function getActiveGroupForPath(pathname: string): string | null {
  const group = NAV_GROUPS.find((entry) => entry.items.some((item) =>
    item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))));
  return group?.key ?? null;
}

export function visibleNavGroups(permissions: string[]): AdminNavGroup[] {
  return NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const required = NAV_PERMISSIONS[item.href];
        return !required || permissions.includes(required);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function visibleFooterItems(permissions: string[]): AdminFooterItem[] {
  return FOOTER_ITEMS.filter((item) => {
    const required = NAV_PERMISSIONS[item.href];
    return !required || permissions.includes(required);
  });
}
