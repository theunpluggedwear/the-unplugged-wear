export const instant = false;
import { Suspense } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { AppFallbackSkeleton } from '@/components/layout/page-skeletons';
import { session } from '@/server/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const claims = await session.requireStaff(undefined, '/dashboard');
  return (
    <DashboardShell permissions={claims.perms}>
      <Suspense fallback={<AppFallbackSkeleton />}>
        {children}
      </Suspense>
    </DashboardShell>
  );
}
