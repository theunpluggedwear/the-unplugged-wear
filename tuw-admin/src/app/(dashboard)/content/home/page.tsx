import DashboardShell from '@/components/layout/DashboardShell';
import { adminListSections } from '@tuw/heart/modules/content';
import { session } from '@/server/session';
import HomeSectionsManager from './_components/HomeSectionsManager';

export default async function ContentHomePage() {
  const claims = await session.requireStaff('content.manage', '/content/home');
  const sections = await adminListSections('home', claims.sub);
  return (
    <DashboardShell>
      <HomeSectionsManager initial={sections} />
    </DashboardShell>
  );
}
