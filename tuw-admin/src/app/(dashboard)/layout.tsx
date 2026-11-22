export const instant = false;
import { Suspense } from 'react';
import PageSkeleton from '@/components/layout/PageSkeleton';









export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton pageTitle="Dashboard" />}>
      {children}
    </Suspense>
  );
}
