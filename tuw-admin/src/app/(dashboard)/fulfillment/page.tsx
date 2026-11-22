export const instant = false;
import { adminListFulfillment } from '@tuw/heart/modules/fulfillment';
import { qikinkHealth } from '@tuw/heart/integrations/fulfillment';
import { getSetting } from '@tuw/heart/modules/settings';
import { session } from '@/server/session';
import FulfillmentView from './_components/FulfillmentView';

// Server Component: the first page of the board arrives with the HTML; tabs,
// search, paging, wallet/COD panels and every provider action then ask the
// server (server/fulfillment-actions.ts). The partner's host and the
// auto-submit switch are read here so the footer cannot claim something the
// server is not doing.
export default async function FulfillmentPage() {
  const claims = await session.requireStaff('shipment.manage', '/fulfillment');
  const [initial, autoSubmit, health] = await Promise.all([
    adminListFulfillment({ tab: 'all', perPage: 20 }),
    getSetting('fulfillment.auto_submit'),
    Promise.resolve(qikinkHealth()),
  ]);
  return <FulfillmentView initial={initial} perms={claims.perms} autoSubmit={autoSubmit} health={health} />;
}
