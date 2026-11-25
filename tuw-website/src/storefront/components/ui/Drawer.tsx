'use client';

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { lockBodyScroll } from './scroll-lock';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  position?: 'right' | 'left' | 'bottom';
  maxWidth?: string;
  className?: string;
  bodyClassName?: string;
  hideHeader?: boolean;
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  position = 'right',
  maxWidth = 'max-w-md',
  className = '',
  bodyClassName = 'p-6',
  hideHeader = false,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  // Kept in a ref so a parent re-render (new onClose identity) never re-runs
  // the open/close effect and steals focus back to the panel.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const unlock = lockBodyScroll();
    // Return focus to whatever opened the drawer (e.g. the bag icon).
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Keep Tab / Shift+Tab inside the open drawer.
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unlock();
      window.removeEventListener('keydown', handleKeyDown);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const positionClasses = {
    right: 'inset-y-0 right-0',
    left: 'inset-y-0 left-0',
    bottom: 'inset-x-0 bottom-0 max-h-[85vh]',
  }[position];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={!hideHeader && title ? titleId : undefined}
      aria-describedby={!hideHeader && subtitle ? subtitleId : undefined}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-400 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Surface */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`fixed outline-none ${positionClasses} w-full ${maxWidth} bg-white shadow-2xl flex flex-col z-10 border-l border-store-card-border duration-500 ease-out animate-in slide-in-from-${position} ${className}`}
      >
        {/* Header (Rolls-Royce Stagger Delay 1) */}
        {!hideHeader && (
          <div className="flex items-center justify-between px-6 py-5 border-b border-store-card-border shrink-0 tuw-reveal-item tuw-delay-1">
            <div>
              {title && (
                <h3 id={titleId} className="text-xl font-heading font-medium tracking-tight text-store-charcoal">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p id={subtitleId} className="text-xs text-store-muted mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="p-1.5 rounded-full text-store-muted hover:text-store-charcoal hover:bg-store-cream transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>

        {/* Fixed Footer */}
        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
