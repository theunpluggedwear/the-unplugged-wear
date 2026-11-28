import type { SettingsValues } from '@tuw/heart/modules/settings';

export type FieldKind = 'text' | 'email' | 'money' | 'int' | 'bool' | 'select' | 'color' | 'textarea' | 'fixed';

export interface DraftField {
  key: string;
  kind: FieldKind;
}

export type Draft = Record<string, string | boolean>;

export const paiseToRupees = (p: number) => `${Math.floor(p / 100)}.${String(p % 100).padStart(2, '0')}`;

export function toDraft(fields: DraftField[], values: SettingsValues): Draft {
  const draft: Draft = {};
  for (const f of fields) {
    if (f.kind === 'fixed') continue;
    const v = (values as Record<string, unknown>)[f.key];
    draft[f.key] = f.kind === 'bool' ? Boolean(v) : f.kind === 'money' ? paiseToRupees(v as number) : v == null ? '' : String(v);
  }
  return draft;
}
