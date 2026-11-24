'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SidebarNavGroup, SidebarNavItem } from './sidebar-nav';
import { getActiveGroupForPath, visibleFooterItems, visibleNavGroups } from '@/lib/admin-nav';

interface SidebarProps {
  mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  permissions: string[];
}

let globalOpenGroups: Set<string> | null = null;
const STORAGE_KEY = 'tuw_admin_open_groups';

export default function Sidebar({ mobileMenuOpen, onCloseMobileMenu, permissions }: SidebarProps) {
  const pathname = usePathname();
  const groups = visibleNavGroups(permissions);
  const footer = visibleFooterItems(permissions);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => globalOpenGroups ?? new Set<string>());

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const next = new Set<string>(parsed.filter((value): value is string => typeof value === 'string'));
          globalOpenGroups = next;
          setOpenGroups(next);
        }
      }
    } catch {
      
    }
  }, []);

  React.useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMobileMenu();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, onCloseMobileMenu]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = prev.has(key) ? new Set<string>() : new Set<string>([key]);
      globalOpenGroups = next;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        
      }
      return next;
    });
  };

  const getIsActive = (path: string) => {
    if (path === '/' || path === '/dashboard') return pathname === '/' || pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  const handleSidebarClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('a')) onCloseMobileMenu();
  };

  return (
    <aside
      className={cn(
        'sidebar fixed left-0 top-0 z-[100] flex h-dvh w-[290px] max-w-[86vw] shrink-0 flex-col overflow-hidden border-r border-subtle bg-canvas px-[14px] pb-4 transition-transform md:hidden',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
      )}
      onClick={handleSidebarClick}
    >
      <div className="flex h-20 min-h-20 w-full shrink-0 items-center justify-between border-b border-subtle bg-canvas">
        <Link href="/dashboard" className="flex items-center gap-2.5 no-underline text-primary" onClick={onCloseMobileMenu}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary shadow-nav-logo">
            <Image src="/logos/tuw-stag-white.png" alt="The Unplugged Wear" width={22} height={22} className="h-[22px] w-auto object-contain" priority />
          </div>
          <span className="whitespace-nowrap text-[20px] font-bold tracking-auth-hero text-primary">TUW Admin</span>
        </Link>
        <button type="button" className="flex size-7.5 shrink-0 items-center justify-center rounded-control border border-subtle bg-surface text-primary" onClick={onCloseMobileMenu} aria-label="Close menu" title="Close menu">
          <X size={18} />
        </button>
      </div>

      <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-6 pr-1">
        {groups.map((group) => {
          const actives = group.items.map((item) => item.match.some((prefix) => getIsActive(prefix)));
          return (
            <SidebarNavGroup
              key={group.key}
              groupKey={group.key}
              label={group.label}
              icon={group.icon}
              isCollapsed={false}
              open={openGroups.has(group.key)}
              chevronOpen={openGroups.has(group.key)}
              groupActive={getActiveGroupForPath(pathname) === group.key}
              stemIdx={actives.findIndex(Boolean)}
              onToggle={toggleGroup}
            >
              {group.items.map((item, index) => (
                <SidebarNavItem key={item.href} item={item} active={actives[index]} isCollapsed={false} variant="branch" />
              ))}
            </SidebarNavGroup>
          );
        })}
      </div>

      <div className="mt-auto flex shrink-0 flex-col border-t border-subtle bg-canvas pt-2">
        <ul className="flex list-none flex-col gap-[3px]">
          {footer.map((item) => (
            <li key={item.href}>
              <SidebarNavItem item={item} active={item.match.some((prefix) => getIsActive(prefix))} isCollapsed={false} variant={item.variant} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
