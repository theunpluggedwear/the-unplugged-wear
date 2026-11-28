'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, Package, User, UserRound } from 'lucide-react';
import { useSession, type SessionSummary } from '@storefront/lib/session';

const triggerClass =
  'hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-full items-center justify-center text-store-text-primary hover:text-black hover:bg-black/5 active:scale-95 transition-all cursor-pointer';

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Signed-out account icon (also the static fallback while the session streams). */
export function AccountLinkView({ session }: { session: SessionSummary | null }) {
  if (session) return <AccountMenu session={session} />;
  return (
    <Link href="/login" aria-label="Log in" className={triggerClass}>
      <User size={20} />
    </Link>
  );
}

/**
 * Signed-in avatar: opens a small menu (My account, Orders, Log out) instead
 * of jumping straight to the account page.
 * Keyboard: Enter/Space/↓ opens, ↑↓ move, Home/End jump, Esc closes, Tab leaves.
 */
function AccountMenu({ session }: { session: SessionSummary }) {
  const { signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  // Close on outside click / focus leaving the menu.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onFocus = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    requestAnimationFrame(() => items()[0]?.focus());
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      list[(next + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') setOpen(false);
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    const ok = await signOut(); // navigates away on success
    if (!ok) {
      setSigningOut(false);
      setSignOutError(true);
    }
  };

  const itemClass =
    'flex w-full items-center gap-3 px-4 py-2.5 text-sm text-store-charcoal hover:bg-store-cream focus:bg-store-cream focus:outline-none transition-colors cursor-pointer';

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${session.name}`}
        className={`${triggerClass} sm:flex ${open ? 'bg-black/5' : ''}`}
      >
        <span className="w-7 h-7 rounded-full bg-store-charcoal text-white text-2xs font-medium flex items-center justify-center">
          {initialsOf(session.name)}
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full mt-2 z-50 w-60 overflow-hidden rounded-xl border border-store-card-border bg-store-surface shadow-xl shadow-black/10 tuw-mega-in"
        >
          <div className="px-4 py-3 border-b border-store-card-border">
            <p className="text-sm font-semibold text-store-charcoal truncate">{session.name}</p>
            <p className="text-xs text-store-muted truncate">{session.email}</p>
          </div>
          <div className="py-1">
            <Link href="/account" role="menuitem" tabIndex={-1} onClick={() => close(false)} className={itemClass}>
              <UserRound size={16} className="text-store-muted" aria-hidden="true" />
              My account
            </Link>
            <Link href="/account/orders" role="menuitem" tabIndex={-1} onClick={() => close(false)} className={itemClass}>
              <Package size={16} className="text-store-muted" aria-hidden="true" />
              Orders
            </Link>
          </div>
          <div className="py-1 border-t border-store-card-border">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={handleSignOut}
              disabled={signingOut}
              aria-busy={signingOut || undefined}
              className={`${itemClass} disabled:opacity-60 disabled:cursor-wait`}
            >
              <LogOut size={16} className="text-store-muted" aria-hidden="true" />
              {signingOut ? 'Logging out…' : 'Log out'}
            </button>
            {signOutError && (
              <p role="alert" className="px-4 pb-2 text-xs text-store-terracotta">
                Couldn’t log you out. Please try again.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function HeaderAccountLink() {
  const { session } = useSession();
  return <AccountLinkView session={session} />;
}
