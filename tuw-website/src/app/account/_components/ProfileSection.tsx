'use client';

import { useAccountPage } from './AccountShell';
import PersonalDetailsCard from './profile/PersonalDetailsCard';
import SecurityCard from './profile/SecurityCard';
import HouseholdCard from './profile/HouseholdCard';

/** /account/profile — personal details, sign-in & security, household. Read first; Edit opens a form. */
export default function ProfileSection() {
  const { account } = useAccountPage();
  if (!account.account) {
    return <p role="status" className="py-16 text-center text-sm text-store-text-secondary border border-store-card-border bg-store-surface">Loading your profile…</p>;
  }
  return (
    <div className="space-y-6">
      <PersonalDetailsCard />
      <SecurityCard />
      <HouseholdCard />
    </div>
  );
}
