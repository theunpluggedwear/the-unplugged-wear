export const instant = false;
import DashboardShell from '@/components/layout/DashboardShell';
import { adminListPages } from '@tuw/heart/modules/content';
import { session } from '@/server/session';
import PagesManager from './_components/PagesManager';

export default async function ContentPagesPage() {
  const claims = await session.requireStaff('content.manage', '/content/pages');
  const initial = await adminListPages(claims.sub);
  return (
    <DashboardShell>
      <PagesManager initial={initial} />
    </DashboardShell>
  );
}
