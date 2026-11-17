'use server';

import * as newsletter from '@tuw/heart/modules/marketing';
import { marketingSchemas as s } from '@tuw/heart/modules/marketing';
import { hitRateLimit } from '@tuw/heart/platform/ratelimit';
import { guards, session } from './session';

export const subscribeNewsletterAction = guards.action({
  access: 'public',
  input: s.newsletterSubscribe,
}, async ({ input }) => {
  const { ip } = await session.requestMeta();
  await hitRateLimit('newsletter.subscribe', [
    { key: ip ?? '', max: 20, windowSeconds: 600 },
    { key: input.email, max: 5, windowSeconds: 3600 },
  ]);
  return newsletter.subscribe(input.email, 'footer');
});

export const confirmNewsletterAction = guards.action({
  access: 'public',
  input: s.newsletterToken,
}, async ({ input }) => newsletter.confirm(input.token));

export const unsubscribeNewsletterAction = guards.action({
  access: 'public',
  input: s.newsletterToken,
}, async ({ input }) => newsletter.unsubscribe(input.token));
