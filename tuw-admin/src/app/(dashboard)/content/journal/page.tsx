export const instant = false;
import { adminJournalMeta, adminListPosts } from '@tuw/heart/modules/marketing';
import { session } from '@/server/session';
import JournalManager from './_components/JournalManager';

export default async function JournalPage() {
  const claims = await session.requireStaff('content.manage', '/content/journal');
  const [posts, meta] = await Promise.all([
    adminListPosts({ status: 'all', page: 1, perPage: 50 }, claims.sub),
    adminJournalMeta(claims.sub),
  ]);
  return (
    <>
      <JournalManager initial={posts.rows} meta={meta} />
    </>
  );
}
