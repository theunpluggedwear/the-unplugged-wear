'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePopoverAnimation } from '@/hooks/usePopoverAnimation';
import { getActiveGroupForPath, visibleNavGroups, type AdminNavGroup } from '@/lib/admin-nav';

interface TopNavProps {
  permissions: string[];
}

export default function TopNav({ permissions }: TopNavProps) {
  const pathname = usePathname();
  const groups = visibleNavGroups(permissions);
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [renderedKey, setRenderedKey] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const anim = usePopoverAnimation(openKey !== null, () => setRenderedKey(null));
  const activeGroup = getActiveGroupForPath(pathname);

  React.useEffect(() => {
    if (openKey) setRenderedKey(openKey);
  }, [openKey]);

  React.useEffect(() => {
    const close = () => setOpenKey(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenKey(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const rendered: AdminNavGroup | undefined = groups.find((group) => group.key === renderedKey);
  const isItemActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      ref={containerRef}
      className="topNav"
      aria-label="Primary navigation"
      onMouseLeave={() => setOpenKey(null)}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseEnter={() => anim.cancelClose()}
    >
      <div className="topNavTriggers">
        {groups.map((group) => {
          const isOpen = openKey === group.key;
          const GroupIcon = group.icon;
          return (
            <button
              key={group.key}
              type="button"
              className={cn('topNavTrigger', activeGroup === group.key && 'topNavTriggerActive')}
              aria-haspopup="true"
              aria-expanded={isOpen}
              aria-controls={`mega-${group.key}`}
              onMouseEnter={() => setOpenKey(group.key)}
              onFocus={() => setOpenKey(group.key)}
              onClick={() => setOpenKey(group.key)}
            >
              <GroupIcon size={16} />
              <span>{group.label}</span>
              <ChevronDown size={13} className={cn('topNavChevron', isOpen && 'topNavChevronOpen')} />
            </button>
          );
        })}
      </div>

      {anim.visible && rendered ? (
        <div
          id={`mega-${rendered.key}`}
          role="menu"
          aria-label={`${rendered.label} menu`}
          className={cn('megaMenu', anim.phase === 'closing' ? 'animate-[popoverOut_0.15s_ease-in]' : 'animate-[popoverIn_0.18s_ease-out]')}
        >
          <div className="megaMenuHead">
            <span className="megaMenuTitle">{rendered.label}</span>
            <span className="megaMenuCount">{rendered.items.length} sections</span>
          </div>
          <div className="megaMenuGrid">
            {rendered.items.map((item) => {
              const ItemIcon = item.icon;
              const active = isItemActive(item.href) || item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className={cn('megaMenuItem', active && 'tuw-3d-active')}
                  onClick={() => setOpenKey(null)}
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
    </nav>
  );
}
