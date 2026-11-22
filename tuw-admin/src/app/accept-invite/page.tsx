import { Suspense } from 'react';
import { describeInvite } from '@tuw/heart/modules/auth';
import SignUpPage from '@/components/forms/SignUpPage';


export default function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <InviteForm searchParams={searchParams} />
    </Suspense>
  );
}

async function InviteForm({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const invite = await describeInvite(token);
  return <SignUpPage invite={invite ? { token, email: invite.email, role: invite.role } : null} />;
}
