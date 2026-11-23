export const instant = false;
import { Suspense } from 'react';
import { listLibrary } from '@tuw/heart/modules/catalog';
import { AttributesSkeleton } from '@/components/layout/page-skeletons';
import { session } from '@/server/session';
import AttributesView from './_components/AttributesView';

async function Screen() {
  const claims = await session.requireStaff(undefined, '/settings/attributes');
  return <AttributesView initialLibrary={await listLibrary()} canManage={claims.perms.includes('product.update')} />;
}

export default function AttributesPage() {
  return (
    <Suspense fallback={<AttributesSkeleton />}>
      <Screen />
    </Suspense>
  );
}
