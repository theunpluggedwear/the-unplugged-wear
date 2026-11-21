import DashboardShell from '@/components/layout/DashboardShell';
import { adminGetNavigation } from '@tuw/heart/modules/content';
import { session } from '@/server/session';
import NavigationManager from './_components/NavigationManager';

export default async function ContentNavigationPage() {
  const claims = await session.requireStaff('content.manage', '/content/navigation');
  const navbar = await adminGetNavigation(claims.sub);
  return (
    <DashboardShell>
      <NavigationManager initial={navbar} />
    </DashboardShell>
  );
}
