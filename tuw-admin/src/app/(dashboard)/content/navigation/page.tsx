export const instant = false;
import React from 'react';
import { adminGetMenu } from '@tuw/heart/modules/content';
import { session } from '@/server/session';
import NavigationManager from './_components/NavigationManager';

export default async function ContentNavigationPage() {
  const claims = await session.requireStaff('content.manage', '/content/navigation');
  const menu = await adminGetMenu(claims.sub);
  return (
    <>
      <NavigationManager items={menu} />
    </>
  );
}
