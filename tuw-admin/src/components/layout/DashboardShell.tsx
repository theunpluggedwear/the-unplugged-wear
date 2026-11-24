'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import TopNav from '@/components/layout/TopNav';
import { pageTitleFor } from '@/lib/page-titles';

interface DashboardShellProps {
  children: React.ReactNode;
  pageTitle?: string;
  activeNav?: string;
  permissions: string[];
}

export default function DashboardShell({ children, pageTitle, permissions }: DashboardShellProps) {
  const pathname = usePathname();
  const title = pageTitle ?? pageTitleFor(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-stretch bg-canvas font-sans text-primary">
      {mobileMenuOpen ? (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-[95] cursor-pointer touch-manipulation bg-black/45 blur-[2px] animate-[tuwFadeIn_0.2s_ease-out]"
        />
      ) : null}

      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        permissions={permissions}
      />

      <Header
        pageTitle={title}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />
      <TopNav permissions={permissions} />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full min-w-0 flex-1 flex-col gap-5 px-7 pb-10 pt-6 max-md:px-4 max-md:pb-8 max-md:pt-4"
      >
        {children}
      </main>
    </div>
  );
}
