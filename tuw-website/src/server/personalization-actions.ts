'use server';

import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createLocalDiskStore } from '@tuw/heart/integrations/storage';
import { guards } from './session';

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const store = createLocalDiskStore(join(process.cwd(), '.data', 'personalization'), MAX_BYTES);

export const uploadPersonalizationImageAction = guards.action({
  access: 'public',
  input: z.object({ contentType: z.string(), base64: z.string().min(1) }),
}, async ({ input }) => {
  const ext = TYPES[input.contentType];
  if (!ext) throw new Error('Choose a PNG, JPEG or WebP image.');
  const bytes = new Uint8Array(Buffer.from(input.base64, 'base64'));
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new Error('The image must be under 10 MB.');
  const key = `${randomUUID()}.${ext}`;
  await store.put(key, bytes, input.contentType);
  return { key, url: `/api/personalization/assets/${key}` };
});
