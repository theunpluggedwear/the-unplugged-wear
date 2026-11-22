'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { cn } from '@/lib/cn';
import { pageTitleFor } from '@/lib/page-titles';

interface DashboardShellProps {
  children: React.ReactNode;
  pageTitle?: string;
  activeNav?: string;
}

let globalIsCollapsed: boolean = false;

export default function DashboardShell({
  children,
  pageTitle,
}: DashboardShellProps) {
  const pathname = usePathname();
  const title = pageTitle ?? pageTitleFor(pathname);
  const [isCollapsed, setIsCollapsed] = useState(() => globalIsCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('tuw_admin_sidebar_collapsed');
      if (stored !== null) {
        const val = stored === 'true';
        globalIsCollapsed = val;
        setIsCollapsed(val);
      }
    } catch {
      
    }
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      globalIsCollapsed = next;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('tuw_admin_sidebar_collapsed', String(next));
        } catch {
          
        }
      }
      return next;
    });
  };

  return (
    <div className="relative flex min-h-screen w-full items-stretch bg-canvas font-sans text-primary">
      {}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-[95] cursor-pointer touch-manipulation bg-black/45 blur-[2px] animate-[tuwFadeIn_0.2s_ease-out]"
        />
      )}

      {}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />

      {}
      <div className={cn('flex min-h-screen min-w-0 flex-1 flex-col bg-canvas', isCollapsed ? 'ml-20' : 'ml-60 md:ml-55 lg:ml-60', 'max-md:ml-0')}>
        <Header
          pageTitle={title}
          mobileMenuOpen={mobileMenuOpen}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {}
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full min-w-0 flex-col gap-5 px-7 pb-10 pt-6 max-md:px-4 max-md:pb-8 max-md:pt-4"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
