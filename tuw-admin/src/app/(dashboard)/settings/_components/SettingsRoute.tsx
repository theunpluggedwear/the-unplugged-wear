import { Suspense } from 'react';
import { SettingsSkeleton } from '@/components/layout/page-skeletons';
import SettingsScreen from './SettingsScreen';
import type { SettingsTab } from './tabs';




export default function SettingsRoute({ tab }: { tab: SettingsTab }) {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsScreen tab={tab} />
    </Suspense>
  );
}
