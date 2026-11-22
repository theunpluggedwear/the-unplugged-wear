import { Suspense } from 'react';
import PageSkeleton from '@/components/layout/PageSkeleton';
import SettingsScreen from './SettingsScreen';
import type { SettingsTab } from './tabs';




export default function SettingsRoute({ tab }: { tab: SettingsTab }) {
  return (
    <Suspense fallback={<PageSkeleton pageTitle="Settings" />}>
      <SettingsScreen tab={tab} />
    </Suspense>
  );
}
