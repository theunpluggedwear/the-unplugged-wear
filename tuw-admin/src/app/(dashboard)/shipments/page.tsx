export const instant = false;
import { adminListShipments } from '@tuw/heart/modules/fulfillment';
import { session } from '@/server/session';
import ShipmentsView from './_components/ShipmentsView';



export default async function ShipmentsPage() {
  const claims = await session.requireStaff('shipment.manage', '/shipments');
  const initial = await adminListShipments({ status: 'all', perPage: 15 });
  return <ShipmentsView initial={initial} perms={claims.perms} />;
}
