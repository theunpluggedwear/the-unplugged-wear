export const instant = false;
import { adminListFulfillment } from '@tuw/heart/modules/fulfillment';
import { qikinkHealth } from '@tuw/heart/integrations/fulfillment';
import { getSetting } from '@tuw/heart/modules/settings';
import { session } from '@/server/session';
import FulfillmentView from './_components/FulfillmentView';






export default async function FulfillmentPage() {
  const claims = await session.requireStaff('shipment.manage', '/fulfillment');
  const [initial, autoSubmit, health] = await Promise.all([
    adminListFulfillment({ tab: 'all', perPage: 20 }),
    getSetting('fulfillment.auto_submit'),
    Promise.resolve(qikinkHealth()),
  ]);
  return <FulfillmentView initial={initial} perms={claims.perms} autoSubmit={autoSubmit} health={health} />;
}
