'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, Menu, X } from 'lucide-react';
import { getCurrentStaffAction } from '@/server/session-actions';
import { SearchModal } from '@/components/search';
import { useNotifications, useStaffAlerts, NotificationPanel } from '@/components/notifications';
import { usePopoverAnimation } from '@/hooks/usePopoverAnimation';

interface HeaderProps {
  pageTitle?: string;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

interface StaffInfo {
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export default function Header({
  pageTitle = 'Dashboard',
  mobileMenuOpen,
  onToggleMobileMenu,
}: HeaderProps) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffInfo | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifAnim = usePopoverAnimation(showNotifications, () => setShowNotifications(false));

  useEffect(() => {
    let live = true;
    void getCurrentStaffAction({}).then((result) => {
      if (live && result.ok) setStaff(result.data);
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
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

  return (
    <>
      <header className="topBar">
        <div className="topBarLeft">
          <button type="button" className="mobileMenuBtn" onClick={onToggleMobileMenu} aria-label="Toggle menu">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="pageTitle">{pageTitle}</h1>
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

          <div className="userProfile" title={`Logged in as ${displayName}`}>
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
            <div className="userInfo">
              <span className="userName">{displayName}</span>
              <span className="userRole" style={{ color: 'var(--tuw-action-primary)', fontWeight: 600 }}>
                {role}
              </span>
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
