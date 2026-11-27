export interface PersonalizationLike {
  monogram?: string;
  placement?: string;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
}

export interface PersonalizationProductCapability {
  monogram?: { maxChars: number };
}

export interface PersonalizationProductRow {
  monogram_enabled: boolean;
  monogram_max_chars: number;
}

export interface PersonalizationCartLine {
  personalization: PersonalizationLike | null;
  productKind: 'physical' | 'gift_card';
  previewApproved: boolean;
}

export interface PersonalizationPort {
  normalize(
    input: PersonalizationLike | undefined,
    monogram: { maxChars: number } | null,
    previewUrl: string | undefined,
    productKind: 'physical' | 'gift_card',
  ): PersonalizationLike | null;
  checkoutBlocker(line: PersonalizationCartLine): string | null;
  productCapability(row: PersonalizationProductRow): PersonalizationProductCapability;
  previewUrlAllowed(url: string): boolean;
}
