'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Bell, Menu, X, ChevronDown } from 'lucide-react';
import { getCurrentStaffAction } from '@/server/session-actions';
import { SearchModal } from '@/components/search';
import { useNotifications, useStaffAlerts, NotificationPanel } from '@/components/notifications';
import { usePopoverAnimation } from '@/hooks/usePopoverAnimation';
import { cn } from '@/lib/cn';
import { getActiveGroupForPath, visibleNavGroups, type AdminNavGroup } from '@/lib/admin-nav';

interface HeaderProps {
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  permissions: string[];
}

interface StaffInfo {
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export default function Header({ mobileMenuOpen, onToggleMobileMenu, permissions }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [staff, setStaff] = useState<StaffInfo | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifAnim = usePopoverAnimation(showNotifications, () => setShowNotifications(false));
  const navGroups = visibleNavGroups(permissions);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [renderedKey, setRenderedKey] = useState<string | null>(null);
  const navSuppressedRef = React.useRef<string | null>(null);
  const navSourceRef = React.useRef<'hover' | 'click' | null>(null);
  const navRef = React.useRef<HTMLDivElement>(null);
  const navAnim = usePopoverAnimation(openKey !== null, () => setRenderedKey(null));
  const activeGroup = getActiveGroupForPath(pathname);

  useEffect(() => {
    let live = true;
    void getCurrentStaffAction({}).then((result) => {
      if (live && result.ok) setStaff(result.data);
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (openKey) setRenderedKey(openKey);
  }, [openKey]);

  useEffect(() => {
    setOpenKey(null);
    setRenderedKey(null);
    navSourceRef.current = null;
  }, [pathname]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (navRef.current?.contains(event.target as Node)) return;
      setOpenKey(null);
      navSourceRef.current = null;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setOpenKey(null);
        navSuppressedRef.current = 'all';
        navSourceRef.current = null;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (href: string) => {
    setIsSearchOpen(false);
    router.push(href);
  };

  const alerts = useStaffAlerts(showNotifications);
  const notifications = useNotifications(alerts.items, alerts.remote);
  const role = staff?.roles.find((item) => item !== 'customer') ?? 'Staff';
  const displayName = staff?.name ?? 'Staff';
  const rendered: AdminNavGroup | undefined = navGroups.find((group) => group.key === renderedKey);

  return (
    <>
      <header className="topBar">
        <div className="topBarLeft">
          <button type="button" className="mobileMenuBtn" onClick={onToggleMobileMenu} aria-label="Toggle menu">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link href="/dashboard" className="topBrand" aria-label="TUW Admin home">
            <Image src="/logos/tuw-stag-dark.png" alt="The Unplugged Wear" width={26} height={26} className="topBrandMark" priority />
            <span className="topBrandText">TUW Admin</span>
          </Link>
        </div>

        <div
          className="topBarCenter"
          ref={navRef}
          onMouseLeave={() => {
            setOpenKey(null);
            navSuppressedRef.current = null;
            navSourceRef.current = null;
          }}
          onMouseEnter={() => navAnim.cancelClose()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="topNavTriggers">
            {navGroups.map((group) => {
              const isOpen = openKey === group.key;
              const GroupIcon = group.icon;
              return (
                <button
                  key={group.key}
                  type="button"
                  className={cn('topNavTrigger', (isOpen || activeGroup === group.key) && 'topNavTriggerActive')}
                  aria-haspopup="true"
                  aria-expanded={isOpen}
                  aria-controls={`mega-${group.key}`}
                  onMouseEnter={() => {
                    if (navSuppressedRef.current === group.key || navSuppressedRef.current === 'all') return;
                    setOpenKey(group.key);
                    navSourceRef.current = 'hover';
                  }}
                  onFocus={() => {
                    if (navSuppressedRef.current === group.key || navSuppressedRef.current === 'all') return;
                    setOpenKey(group.key);
                    navSourceRef.current = 'hover';
                  }}
                  onClick={() => {
                    if (openKey === group.key) {
                      setOpenKey(null);
                      navSuppressedRef.current = group.key;
                      navSourceRef.current = null;
                    } else {
                      setOpenKey(group.key);
                      navSourceRef.current = 'click';
                      navSuppressedRef.current = null;
                    }
                  }}
                >
                  <GroupIcon size={16} />
                  <span>{group.label}</span>
                  <ChevronDown size={13} className={cn('topNavChevron', isOpen && 'topNavChevronOpen')} />
                </button>
              );
            })}
          </div>

          {navAnim.visible && rendered ? (
            <div
              id={`mega-${rendered.key}`}
              role="menu"
              aria-label={`${rendered.label} menu`}
              className={cn('megaMenu', navAnim.phase === 'closing' ? 'animate-[popoverOut_0.15s_ease-in]' : 'animate-[popoverIn_0.18s_ease-out]')}
            >
              <div className="megaMenuHead">
                <span className="megaMenuTitle">{rendered.label}</span>
                <span className="megaMenuCount">{rendered.items.length} sections</span>
              </div>
              <div className="megaMenuGrid">
                {rendered.items.map((item) => {
                  const ItemIcon = item.icon;
                  const active = item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      className={cn('megaMenuItem', active && 'tuw-3d-active')}
                      onClick={() => {
                        setOpenKey(null);
                        navSuppressedRef.current = 'all';
                        navSourceRef.current = null;
                      }}
                    >
                      <span className="megaMenuItemIcon"><ItemIcon size={17} /></span>
                      <span className="megaMenuItemText">
                        <span className="megaMenuItemLabel">{item.label}</span>
                        {item.badge ? <span className="megaMenuBadge">{item.badge.text}</span> : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="topBarRight">
          <div className="actionIcons">
            <button
              type="button"
              className="searchTriggerBtn"
              aria-label="Search"
              title="Search orders, products, customers (Ctrl+K)"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search size={18} />
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="notificationBtn"
                aria-label="Notifications"
                aria-expanded={notifAnim.visible}
                aria-haspopup="dialog"
                title={`${notifications.unreadCount} unread notifications`}
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={20} />
                {notifications.unreadCount > 0 && (
                  <span className="notificationBadge">{notifications.unreadCount}</span>
                )}
              </button>

              {notifAnim.visible && (
                <>
                  <div
                    aria-hidden="true"
                    onClick={() => setShowNotifications(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div
                    className={`notificationPopover ${
                      notifAnim.phase === 'closing'
                        ? 'animate-[popoverOut_0.15s_ease-in]'
                        : 'animate-[popoverIn_0.18s_ease-out]'
                    }`}
                  >
                    <NotificationPanel
                      repo={notifications}
                      onNavigate={(href) => {
                        setShowNotifications(false);
                        router.push(href);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="userProfile" title={`Logged in as ${displayName} (${role})`} aria-label={`Logged in as ${displayName} (${role})`}>
            <div className="avatarCodeWrapper">
              <svg
                width="40"
                height="40"
                viewBox="0 0 162 163"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="koboyoProfileSvg"
                aria-label={`${displayName} profile`}
              >
                <defs>
                  <linearGradient id="koboyoAvatarGrad" x1="0" y1="0" x2="162" y2="163" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="var(--tuw-action-primary)" />
                    <stop offset="100%" stopColor="var(--tuw-action-primary)" />
                  </linearGradient>
                </defs>
                <circle cx="81" cy="81.5" r="80" fill="var(--tuw-bg-canvas)" />
                <text x="81" y="96" textAnchor="middle" fontSize="52" fontWeight="600" fill="var(--tuw-action-primary)">
                  {displayName.slice(0, 1).toUpperCase()}
                </text>
              </svg>
            </div>
          </div>
        </div>
      </header>

      {isSearchOpen && (
        <div className="commandPaletteOverlay" onClick={() => setIsSearchOpen(false)}>
          <SearchModal onNavigate={handleNavigate} onClose={() => setIsSearchOpen(false)} />
        </div>
      )}
    </>
  );
}
