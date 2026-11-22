export const instant = false;
import { Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import PageSkeleton from '@/components/layout/PageSkeleton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <Suspense fallback={<PageSkeleton pageTitle="Dashboard" />}>
        {children}
      </Suspense>
    </DashboardShell>
  );
}
