export const instant = false;
import { Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { AppFallbackSkeleton } from '@/components/layout/page-skeletons';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <Suspense fallback={<AppFallbackSkeleton />}>
        {children}
      </Suspense>
    </DashboardShell>
  );
}
