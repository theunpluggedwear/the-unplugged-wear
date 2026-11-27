import { AppError } from '../../platform/errors/index.ts';
import type {
  PersonalizationCartLine, PersonalizationLike, PersonalizationPort,
  PersonalizationProductCapability, PersonalizationProductRow,
} from '../../platform/plugins/personalization.ts';

export function normalizePersonalization(
  input: PersonalizationLike | undefined,
  monogram: { maxChars: number } | null,
  previewUrl: string | undefined,
  productKind: 'physical' | 'gift_card',
): PersonalizationLike | null {
  if (!input) return null;
  const gift = input.recipientName || input.recipientEmail || input.message;
  if (productKind === 'gift_card' && gift) {
    if (!input.recipientEmail) throw new AppError('VALIDATION_FAILED', 'Enter the recipient email.', [{ field: 'recipientEmail', message: 'Recipient email required.' }]);
    return {
      ...(input.recipientName ? { recipientName: input.recipientName.trim().slice(0, 150) } : {}),
      recipientEmail: input.recipientEmail.trim().toLowerCase(),
      ...(input.message ? { message: input.message.trim().slice(0, 500) } : {}),
    };
  }
  if (!input.monogram && !input.placement) return null;
  if (!monogram) throw new AppError('RULE_VIOLATION', 'This product cannot be personalised.');
  const text = input.monogram?.trim() ?? '';
  if (!text || text.length > monogram.maxChars) throw new AppError('VALIDATION_FAILED', `Use 1 to ${monogram.maxChars} characters.`, [{ field: 'monogram', message: `Use 1 to ${monogram.maxChars} characters.` }]);
  if (!previewUrl) throw new AppError('VALIDATION_FAILED', 'A personalised item needs a preview before it goes in the bag.', [{ field: 'preview', message: 'Preview required.' }]);
  return { monogram: text, ...(input.placement ? { placement: input.placement.trim() } : {}) };
}

export function personalizationCheckoutBlocker(line: PersonalizationCartLine): string | null {
  if (line.personalization && line.productKind !== 'gift_card' && !line.previewApproved) {
    return 'Approve the print preview first.';
  }
  return null;
}

export function personalizationProductCapability(row: PersonalizationProductRow): PersonalizationProductCapability {
  return row.monogram_enabled ? { monogram: { maxChars: row.monogram_max_chars } } : {};
}

export const personalizationPreviewUrlAllowed = (url: string): boolean =>
  (/^\/(?!\/)/.test(url) || /^https:\/\//i.test(url)) && url.length <= 2048;

export const personalizationPlugin: PersonalizationPort = {
  normalize: normalizePersonalization,
  checkoutBlocker: personalizationCheckoutBlocker,
  productCapability: personalizationProductCapability,
  previewUrlAllowed: personalizationPreviewUrlAllowed,
};
