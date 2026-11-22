export const instant = false;
import { adminListMedia } from '@tuw/heart/modules/content';
import { session } from '@/server/session';
import MediaManager from './_components/MediaManager';

export default async function ContentMediaPage() {
  const claims = await session.requireStaff('content.manage', '/content/media');
  const initial = await adminListMedia(undefined, claims.sub);
  return (
    <>
      <MediaManager initial={initial} />
    </>
  );
}
