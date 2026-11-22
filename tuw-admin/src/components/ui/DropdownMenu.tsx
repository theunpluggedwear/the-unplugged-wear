'use client';

import React, { useState } from 'react';
import { usePopoverAnimation } from '@/hooks/usePopoverAnimation';

export interface DropdownMenuItem {
  value: string;
  label: string;
  
  danger?: boolean;
}

export interface DropdownMenuProps {
  
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  onSelect: (value: string) => void;
  ariaLabel?: string;
  
  align?: 'left' | 'right';
  



  direction?: 'down' | 'up';
  




  selectedValue?: string;
  

  fullWidth?: boolean;
}





export default function DropdownMenu({
  trigger,
  items,
  onSelect,
  ariaLabel = 'Actions',
  align = 'left',
  selectedValue,
  direction = 'down',
  fullWidth = false,
}: DropdownMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const anim = usePopoverAnimation(menuOpen, () => setMenuOpen(false));
  const opensUp = direction === 'up';
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = React.useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    vw: number;
    vh: number;
  } | null>(null);

  const toggle = () => {
    if (!menuOpen && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setAnchor({
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        vw: window.innerWidth,
        vh: window.innerHeight,
      });
    }
    setMenuOpen((v) => !v);
  };

  
  
  React.useEffect(() => {
    if (!anim.visible) return;
    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleResize = () => setMenuOpen(false);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [anim.visible]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: fullWidth ? 'flex' : 'inline-flex', ...(fullWidth ? { width: '100%' } : {}) }}>
      <span onClick={toggle} aria-haspopup="menu" aria-expanded={anim.visible} style={fullWidth ? { flex: 1, minWidth: 0, display: 'flex' } : undefined}>
        {trigger}
      </span>
      {anim.visible && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, cursor: 'default' }}
          />
          <div
            ref={menuRef}
            role="menu"
            aria-label={ariaLabel}
            onClick={(e) => e.stopPropagation()}
            style={{
              
              
              position: 'fixed',
              ...(anchor
                ? opensUp
                  ? {
                      bottom: Math.max(8, anchor.vh - anchor.top + 8),
                      ...(align === 'right'
                        ? { right: Math.max(8, anchor.vw - anchor.right) }
                        : { left: anchor.left }),
                    }
                  : {
                      top: anchor.bottom + 8,
                      ...(align === 'right'
                        ? { right: Math.max(8, anchor.vw - anchor.right) }
                        : { left: anchor.left }),
                    }
                : { visibility: 'hidden' as const }),
              zIndex: 50,
              minWidth: 180,
              maxHeight: 'min(320px, calc(100vh - 32px))',
              overflowY: 'auto',
              padding: 6,
              borderRadius: 'var(--tuw-radius-card, 12px)',
              border: '1px solid var(--tuw-border-subtle, #E5E7EB)',
              backgroundColor: 'var(--tuw-bg-surface, #FFFFFF)',
              boxShadow: '0 12px 32px rgba(23, 28, 51, 0.16), 0 2px 6px rgba(23, 28, 51, 0.08)',
              willChange: 'opacity, transform',
              transform: 'translateZ(0)',
              animation:
                anim.phase === 'closing'
                  ? opensUp
                    ? 'popoverOutUp 0.15s ease-in both'
                    : 'popoverOut 0.15s ease-in both'
                  : opensUp
                    ? 'popoverInUp 0.18s ease-out both'
                    : 'popoverIn 0.18s ease-out both',
            }}
          >
            {items.map((item) => {
              const selected = selectedValue !== undefined && item.value === selectedValue;
              const restingBg = selected
                ? 'var(--tuw-bg-selected, #F8F5FF)'
                : 'transparent';
              return (
              <button
                key={item.value}
                type="button"
                role={selectedValue !== undefined ? 'menuitemradio' : 'menuitem'}
                aria-checked={selectedValue !== undefined ? selected : undefined}
                onClick={() => {
                  onSelect(item.value);
                  setMenuOpen(false);
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = selected
                    ? restingBg
                    : item.danger
                      ? 'var(--tuw-bg-error, #FEF4F4)'
                      : 'var(--tuw-bg-canvas, #F7F8F9)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = restingBg)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: restingBg,
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  fontFamily: 'var(--font-main)',
                  color: selected
                    ? 'var(--tuw-action-primary, #7539FF)'
                    : item.danger
                      ? 'var(--tuw-text-error, #C91818)'
                      : 'var(--tuw-text-primary, #262626)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.1s ease',
                }}
              >
                {item.label}
              </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
