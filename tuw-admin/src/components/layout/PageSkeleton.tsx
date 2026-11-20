import { Skeleton } from '@/components/ui';

// Server-safe Suspense fallback for dashboard routes. It mirrors the shell
// dimensions so navigation keeps the sidebar/header footprint while the
// screen's data streams in, without rendering the client DashboardShell
// (Sidebar/Header use usePathname and cannot appear inside a fallback).
export default function PageSkeleton({ pageTitle }: { pageTitle: string }) {
  return (
    <div className="relative flex min-h-screen w-full items-stretch bg-canvas font-sans text-primary">
      <div className="hidden w-60 shrink-0 border-r border-border max-md:block md:block" aria-hidden="true">
        <div className="border-b border-border px-6 py-5">
          <Skeleton height={24} width="60%" />
        </div>
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={36} />)}
        </div>
      </div>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-canvas md:ml-0">
        <div className="border-b border-border px-7 py-6 max-md:px-4">
          <Skeleton height={28} width="30%" />
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          aria-busy="true"
          aria-label={`Loading ${pageTitle}`}
          className="mx-auto flex w-full min-w-0 flex-col gap-5 px-7 pb-10 pt-6 max-md:px-4 max-md:pb-8 max-md:pt-4"
        >
          <Skeleton height={36} width="40%" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={104} />)}
          </div>
          <Skeleton height={360} />
        </main>
      </div>
    </div>
  );
}
