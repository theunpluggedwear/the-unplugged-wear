'use server';

import * as fulfillment from '@tuw/heart/modules/fulfillment';
import { fulfillmentSchemas as s } from '@tuw/heart/modules/fulfillment';
import { guards } from './session';

// Fulfilment board + shipments screens (TL-BE-11). Reading and acting both
// need shipment.manage (warehouse and admin); every decision re-checks the
// rules in the service, so a stale drawer cannot force a bad transition.
// The Qikink adapter is real when keys exist and the simulator otherwise —
// the footers say which one is talking.

export const listFulfillmentAction = guards.action({ permission: 'shipment.manage', input: s.adminList }, ({ input }) =>
  fulfillment.adminListFulfillment(input));

export const getFulfillmentAction = guards.action({ permission: 'shipment.manage', input: s.fulfillmentRef }, ({ input }) =>
  fulfillment.adminGetFulfillment(input.fulfillmentId));

export const submitWaitingAction = guards.action({ permission: 'shipment.manage', input: s.submitNow }, ({ input }) =>
  fulfillment.adminSubmitFulfillment({ orderNumber: input.orderNumber }));

export const retryFulfillmentAction = guards.action({ permission: 'shipment.manage', input: s.fulfillmentRef }, ({ input }) =>
  fulfillment.adminSubmitFulfillment({ fulfillmentId: input.fulfillmentId }));

export const syncFulfillmentAction = guards.action({ permission: 'shipment.manage', input: s.fulfillmentRef }, ({ input }) =>
  fulfillment.adminSyncFulfillment(input.fulfillmentId));

export const cancelFulfillmentAction = guards.action({ permission: 'shipment.manage', input: s.adminCancel }, ({ input, ctx }) =>
  fulfillment.adminCancelFulfillment(input, ctx.user!.id));

export const setProviderStateAction = guards.action({ permission: 'shipment.manage', input: s.setProviderState }, async ({ input }) => {
  await fulfillment.adminSetFulfillmentState(input);
  return { ok: true };
});

export const reshipAction = guards.action({ permission: 'shipment.manage', input: s.reship }, ({ input, ctx }) =>
  fulfillment.reshipFulfillment(input, ctx.user!.id));

export const listShipmentsAction = guards.action({ permission: 'shipment.manage', input: s.adminShipmentList }, ({ input }) =>
  fulfillment.adminListShipments(input));

export const getShipmentAction = guards.action({ permission: 'shipment.manage', input: s.shipmentRef }, ({ input }) =>
  fulfillment.adminGetShipment(input.shipmentId));

export const addTrackingAction = guards.action({ permission: 'shipment.manage', input: s.addTracking }, ({ input }) =>
  fulfillment.adminAddTracking(input));

export const setShipmentStatusAction = guards.action({ permission: 'shipment.manage', input: s.setShipmentStatus }, async ({ input }) => {
  await fulfillment.adminSetShipmentStatus(input);
  return { ok: true };
});

export const getWalletAction = guards.action({ permission: 'shipment.manage', input: s.walletScope }, async ({ input }) => ({
  summaries: await fulfillment.walletSummaries(),
  ledger: await fulfillment.listWalletLedger({ providerId: input.providerId, limit: 40 }),
}));

export const recordWalletEntryAction = guards.action({ permission: 'shipment.manage', input: s.walletEntry }, ({ input, ctx }) =>
  fulfillment.recordWalletEntry(input, ctx.user!.id));

export const getCodAction = guards.action({ permission: 'shipment.manage', input: s.empty }, async () => ({
  remittances: await fulfillment.listCodRemittances(),
  pending: await fulfillment.pendingCodParcels(),
}));

export const recordRemittanceAction = guards.action({ permission: 'shipment.manage', input: s.codRemittance }, ({ input, ctx }) =>
  fulfillment.recordCodRemittance(input, ctx.user!.id));

export const createClaimAction = guards.action({ permission: 'shipment.manage', input: s.claimCreate }, ({ input, ctx }) =>
  fulfillment.createClaim(input, ctx.user!.id));

export const updateClaimAction = guards.action({ permission: 'shipment.manage', input: s.claimUpdate }, ({ input, ctx }) =>
  fulfillment.updateClaim(input, ctx.user!.id));
