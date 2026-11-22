export const instant = false;
import { adminListDesigns } from '@tuw/heart/modules/content';
import { session } from '@/server/session';
import DesignsManager from './_components/DesignsManager';

export default async function DesignsPage() {
  const claims = await session.requireStaff('content.manage', '/designs');
  const initial = await adminListDesigns({}, claims.sub);
  return (
    <>
      <DesignsManager initial={initial} />
    </>
  );
}
