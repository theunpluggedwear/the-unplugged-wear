import { createQikinkClient, qikinkConfig, qikinkHealth } from '../packages/heart/src/integrations/fulfillment/qikink.ts';

const health = qikinkHealth();
console.log(JSON.stringify({ health }));
if (!health.configured) {
  console.error('QIKINK_CLIENT_ID / QIKINK_CLIENT_SECRET are missing');
  process.exit(1);
}
if (!health.baseUrl.includes('sandbox')) {
  console.error('Refusing to run: QIKINK_BASE_URL is not the sandbox endpoint');
  process.exit(1);
}

const config = qikinkConfig();
const client = createQikinkClient(config);
const design = 'https://sgp1.digitaloceanspaces.com/cdn.qikink.com/erp2/assets/designs/83/1696668376.jpg';
const reference = `QA${Date.now().toString().slice(-12)}`;
const input = {
  reference,
  gateway: 'prepaid',
  totalPaise: 10000,
  lines: [{
    sku: 'MRnHs-Bk-M',
    quantity: 1,
    unitPricePaise: 10000,
    payload: {
      printTypeId: 1,
      designs: [{
        design_code: `QA${reference.slice(-8)}`,
        width_inches: 10,
        height_inches: 10,
        placement_sku: 'fr',
        design_link: design,
        mockup_link: design,
      }],
    },
  }],
  shipTo: {
    name: 'QA Tuw',
    line1: '17 Sanskruti Park Row House',
    city: 'Surat',
    state: 'Gujarat',
    postalCode: '395005',
    phone: '9999999999',
    email: 'qa.product@example.com',
  },
};

const created = await client.createOrder(input);
console.log(JSON.stringify({ step: 'create', reference, providerOrderRef: created.providerOrderRef, status: created.status }));
const read = await client.getOrder(created.providerOrderRef);
console.log(JSON.stringify({ step: 'read', providerOrderRef: read.providerOrderRef, status: read.status }));
try {
  const cancelled = await client.cancelOrder(created.providerOrderRef);
  console.log(JSON.stringify({ step: 'cancel', cancelled: cancelled.cancelled, status: cancelled.providerStatus }));
} catch (error) {
  console.log(JSON.stringify({ step: 'cancel', skipped: error instanceof Error ? error.message : String(error) }));
}
