export interface PreviewInput {
  productId: string;
  color?: string;
  size?: string;
  monogram: string;
  placement?: string;
  maxChars?: number;
}

export function previewUrlFor(input: PreviewInput): string {
  const params = new URLSearchParams({
    p: input.productId,
    c: input.color ?? '',
    s: input.size ?? '',
    m: input.monogram,
    pl: input.placement ?? '',
  });
  if (input.maxChars !== undefined) params.set('mx', String(input.maxChars));
  return `/api/previews?${params.toString()}`;
}

export function validateMonogram(value: string, maxChars: number): string | null {
  const text = value.trim();
  if (!text || text.length > maxChars) return `Use 1 to ${maxChars} characters.`;
  return null;
}

export function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] ?? c);
}
