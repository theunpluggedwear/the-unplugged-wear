export const instant = false;
import React from 'react';
import { adminGetDesktopNav, adminGetMobileNav } from '@tuw/heart/modules/content';
import { session } from '@/server/session';
import NavigationManager from './_components/NavigationManager';

export default async function ContentNavigationPage() {
  const claims = await session.requireStaff('content.manage', '/content/navigation');
  const [mobile, desktop] = await Promise.all([
    adminGetMobileNav(claims.sub),
    adminGetDesktopNav(claims.sub),
  ]);
  return (
    <>
      <NavigationManager mobile={mobile} desktop={desktop} />
    </>
  );
}
