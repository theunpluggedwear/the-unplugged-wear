'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home as HomeIcon,
  ClipboardList,
  Package,
  Users,
  TrendingUp,
  LayoutGrid,
  ShoppingBag,
  ShoppingCart,
  Settings,
  Headphones,
  LogOut,
  PackageCheck,
  Truck,
  Undo2,
  RotateCcw,
  CreditCard,
  Layers,
  Palette,
  FileText,
  ShieldCheck,
  X,
  BadgePercent,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { SidebarNavGroup, SidebarNavItem, SidebarDock } from './sidebar-nav';
import type { SidebarNavItemDef } from './sidebar-nav';
import type { LucideIcon } from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  permissions: string[];
}


let globalOpenGroups: Set<string> | null = null;
const STORAGE_KEY = 'tuw_admin_open_groups';

function getActiveGroupForPath(pathname: string): string | null {
  if (
    pathname === '/' ||
    pathname === '/dashboard' ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/analytics')
  ) {
    return 'core';
  }
  if (
    pathname.startsWith('/fulfillment') ||
    pathname.startsWith('/shipments') ||
    pathname.startsWith('/returns') ||
    pathname.startsWith('/refunds') ||
    pathname.startsWith('/payments') ||
    pathname.startsWith('/discounts') ||
    pathname.startsWith('/abandoned')
  ) {
    return 'operations';
  }
  if (
    pathname.startsWith('/collections') ||
    pathname.startsWith('/designs') ||
    pathname.startsWith('/content')
  ) {
    return 'merchandise';
  }
  if (
    pathname.startsWith('/team')
  ) {
    return 'system';
  }
  return null;
}

interface NavGroupDef {
  key: string;
  label: string;
  icon: LucideIcon;
  items: SidebarNavItemDef[];
}



const NAV_GROUPS: NavGroupDef[] = [
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
    ],
  },
];

interface FooterItemDef {
  href: string;
  label: string;
  icon: LucideIcon;
  match: string[];
  variant: 'footer' | 'danger';
}

const FOOTER_ITEMS: FooterItemDef[] = [
  { href: '/settings', label: 'Settings', icon: Settings, match: ['/settings'], variant: 'footer' },
  { href: '/support', label: 'Help & Support', icon: Headphones, match: ['/support', '/help'], variant: 'footer' },
  { href: '/login', label: 'Log out', icon: LogOut, match: [], variant: 'danger' },
];

const NAV_PERMISSIONS: Readonly<Record<string, string>> = {
  '/orders': 'order.view',
  '/customers': 'customer.view',
  '/reports': 'report.view',
  '/fulfillment': 'shipment.manage',
  '/shipments': 'shipment.manage',
  '/returns': 'return.view',
  '/refunds': 'order.view',
  '/payments': 'order.view',
  '/abandoned': 'order.view',
  '/designs': 'content.manage',
  '/content': 'content.manage',
  '/team': 'user.manage',
  '/settings': 'settings.manage',
  '/support': 'customer.view',
};

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  mobileMenuOpen = false,
  onCloseMobileMenu,
  permissions,
}: SidebarProps) {
  const pathname = usePathname();
  const canSee = (href: string) => {
    const required = NAV_PERMISSIONS[href];
    return !required || permissions.includes(required);
  };
  const visibleGroups = NAV_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item.href)) }))
    .filter((group) => group.items.length > 0);
  const visibleFooter = FOOTER_ITEMS.filter((item) => canSee(item.href));

  
  React.useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobileMenu?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, onCloseMobileMenu]);

  
  const handleSidebarClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a') && mobileMenuOpen && onCloseMobileMenu) {
      onCloseMobileMenu();
    }
  };

  
  
  
  
  
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    if (globalOpenGroups !== null) {
      return new Set(globalOpenGroups);
    }
    const activeGroup = getActiveGroupForPath(pathname) || 'core';
    return new Set<string>([activeGroup]);
  });

  React.useEffect(() => {
    try {
      if (globalOpenGroups !== null) {
        setOpenGroups(new Set(globalOpenGroups));
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const set = new Set<string>(parsed);
          globalOpenGroups = set;
          setOpenGroups(set);
        }
      }
    } catch {
      
    }
  }, []);

  
  

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      
      const next = prev.has(key) ? new Set<string>() : new Set<string>([key]);
      globalOpenGroups = next;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
        } catch {
          
        }
      }
      return next;
    });
  };

  const isGroupOpen = (key: string) => openGroups.has(key);

  const getIsActive = (path: string) => {
    if (path === '/' || path === '/dashboard') {
      return pathname === '/' || pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  
  const childActiveIndex = (activeFlags: boolean[]) => activeFlags.findIndex(Boolean);
  
  const activeGroup = getActiveGroupForPath(pathname);  const coreFlags = [getIsActive('/dashboard'), getIsActive('/orders'), getIsActive('/products'), getIsActive('/customers'), getIsActive('/reports') || getIsActive('/analytics')];
  const opsFlags = [getIsActive('/fulfillment'), getIsActive('/shipments'), getIsActive('/returns'), getIsActive('/refunds'), getIsActive('/payments')];
  const merchFlags = [getIsActive('/collections'), getIsActive('/designs'), getIsActive('/content')];
  const sysFlags = [getIsActive('/team')];
  const coreStem = childActiveIndex(coreFlags);
  const opsStem = childActiveIndex(opsFlags);
  const merchStem = childActiveIndex(merchFlags);
  const sysStem = childActiveIndex(sysFlags);

  return (
    <aside
      className={cn('sidebar', 'fixed left-0 top-0 z-50 flex shrink-0 flex-col overflow-hidden border-r border-subtle bg-canvas transition-[width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]', isCollapsed ? 'w-20 min-w-20 px-[10px] pb-[14px]' : 'w-60 min-w-60 md:w-55 md:min-w-55 lg:w-60 lg:min-w-60 px-[14px] pb-[10px]', mobileMenuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full', 'max-md:bottom-0 max-md:z-[100] max-md:max-w-[86vw] max-md:w-[290px] max-md:min-w-auto max-md:overflow-y-auto max-md:overflow-x-hidden max-md:px-[14px] max-md:pb-4 max-md:shadow-[4px_0_24px_rgba(0,0,0,0.15)] max-md:transition-transform')}
      onClick={handleSidebarClick}
    >
      {}
      <div className={cn('flex w-full shrink-0 items-center bg-canvas border-b border-subtle mb-2 z-10 h-20 min-h-20', isCollapsed ? 'justify-center p-0' : 'justify-between px-1')}>
        <Link href="/" className="flex items-center gap-2.5 no-underline text-primary">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary shadow-nav-logo">
            <Image
              src="/logos/tuw-stag-white.png"
              alt="The Unplugged Wear"
              width={22}
              height={22}
              className="h-[22px] w-auto object-contain"
              priority
            />
          </div>
          {!isCollapsed && <span className="text-[20px] font-bold tracking-auth-hero text-primary whitespace-nowrap">TUW Admin</span>}
        </Link>

        {}
        <button
          type="button"
          className="hidden size-7.5 shrink-0 cursor-pointer items-center justify-center rounded-control border border-subtle bg-surface text-primary transition-all duration-[180ms] hover:border-action-primary hover:bg-selected hover:text-action-primary ml-auto max-md:flex focus-visible:outline-2 focus-visible:outline-action-primary focus-visible:outline-offset-2"
          onClick={onCloseMobileMenu}
          aria-label="Close menu"
          title="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {}
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain mt-0.5 pb-6 pr-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden', isCollapsed ? 'gap-0' : 'gap-2.5')}>
        {visibleGroups.map((group) => {
          const actives = group.items.map((item) => item.match.some((p) => getIsActive(p)));
          const stemIdx = actives.findIndex(Boolean);
          const open = !isCollapsed ? isGroupOpen(group.key) : true;
          return (
            <SidebarNavGroup
              key={group.key}
              groupKey={group.key}
              label={group.label}
              icon={group.icon}
              isCollapsed={isCollapsed}
              open={open}
              chevronOpen={isGroupOpen(group.key)}
              groupActive={activeGroup === group.key}
              stemIdx={stemIdx}
              onToggle={toggleGroup}
            >
            {group.items.map((item, idx) => (
              <SidebarNavItem key={item.href} item={item} active={actives[idx]} isCollapsed={isCollapsed} variant="branch" />
            ))}
            </SidebarNavGroup>
          );
        })}
      </div>

      {}
      <div className="flex flex-col gap-0.5 border-t border-subtle bg-canvas pt-2 pb-0 mt-auto shrink-0 z-10">
        <ul className="list-none flex flex-col gap-[3px]">
          {visibleFooter.map((item) => {
            const active = item.match.some((p) => getIsActive(p));
            return (
            <li key={item.href}>
              <SidebarNavItem item={item} active={active} isCollapsed={isCollapsed} variant={item.variant} />
            </li>
            );
          })}
        </ul>

        {

}
        {}
        <SidebarDock isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} />
      </div>
    </aside>
  );
}
