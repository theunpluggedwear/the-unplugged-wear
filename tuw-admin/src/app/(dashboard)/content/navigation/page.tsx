import React from 'react';
import { adminGetMobileNav } from '@tuw/heart/modules/content';
import DashboardShell from '@/components/layout/DashboardShell';
import { session } from '@/server/session';
import NavigationManager from './_components/NavigationManager';

export default async function ContentNavigationPage() {
  const claims = await session.requireStaff('content.manage', '/content/navigation');
  const mobile = await adminGetMobileNav(claims.sub);
  return (
    <DashboardShell pageTitle="Store Navigation">
      <NavigationManager initial={mobile} />
    </DashboardShell>
  );
}
