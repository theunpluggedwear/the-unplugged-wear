'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { lockBodyScroll } from './scroll-lock';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
  className = '',
}: ModalProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  // Read the latest callback without re-running the focus/scroll effect on every
  // parent render (that would restore focus and relock scroll mid-interaction).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const unlock = lockBodyScroll();
    const surface = surfaceRef.current;
    surface?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !surface) return;

      const focusables = Array.from(
        surface.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) {
        e.preventDefault();
        surface.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || active === surface) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unlock();
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div
        ref={surfaceRef}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} bg-white rounded-2xl p-6 sm:p-8 shadow-2xl z-10 my-8 overflow-hidden transition-all border border-[#E2DDCF] focus:outline-none ${className}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-5 top-5 p-2 rounded-full text-[#8A8A8A] hover:text-[#1A1A1A] hover:bg-[#FAF9F6] transition-colors"
        >
          <X size={18} />
        </button>

        {(title || subtitle) && (
          <div className="mb-6 pr-8">
            {title && (
              <h3 className="text-xl font-bold tracking-tight text-[#1A1A1A]">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-[#666] mt-1 leading-relaxed">{subtitle}</p>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
