export const instant = false;
import { listStaff } from '@tuw/heart/modules/auth';
import { session } from '@/server/session';
import TeamView from './_components/TeamView';




export default async function TeamPage() {
  const me = await session.requireStaff('user.manage', '/team');
  const { members, invites } = await listStaff();
  return <TeamView members={members} invites={invites} currentUserId={me.sub} />;
}
