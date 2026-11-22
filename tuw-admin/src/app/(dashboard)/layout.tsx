export const instant = false;
import { Suspense } from 'react';
import PageSkeleton from '@/components/layout/PageSkeleton';

// Cache Components: the dashboard screens are still client-side demo views
// (random ids, today's date, localStorage) that must render per request, so
// they stream inside one Suspense boundary. As each module moves to the
// backend, DashboardShell's sidebar/header move up into this layout as the
// static shell and the boundaries move down to each card/table
// (admin nextjs-rendering skill; TL-BE-17.06). Until then the fallback is a
// real dashboard shell with a content skeleton, not an empty div — navigations
// keep the sidebar/header in place while the screen's data streams in.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton pageTitle="Dashboard" />}>
      {children}
    </Suspense>
  );
}
