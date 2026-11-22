import React from 'react';
import { adminGetMobileNav } from '@tuw/heart/modules/content';
import { session } from '@/server/session';
import NavigationManager from './_components/NavigationManager';

export default async function ContentNavigationPage() {
  const claims = await session.requireStaff('content.manage', '/content/navigation');
  const mobile = await adminGetMobileNav(claims.sub);
  return <NavigationManager initial={mobile} />;
}
