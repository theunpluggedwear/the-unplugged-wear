import 'server-only';

export * from './adapters.ts';
export { renderTemplate } from './templates.ts';
export { sendQueuedEmails } from './queue.ts';

/** Demo links are shown on screen only when explicitly allowed (never in production). */
export const showDevLinks = (): boolean =>
  process.env.AUTH_SHOW_DEV_LINKS === 'true' && process.env.NODE_ENV !== 'production';
