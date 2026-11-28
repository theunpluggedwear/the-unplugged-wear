'use client';

import React, { useEffect, useState } from 'react';
import { Button, ContentCard, Input, Select } from '@/components/ui';
import { personalizationAdminAction } from './actions';
import {
  isSafePreviewImagePath,
  PLACEMENT_CODES,
  PREVIEW_ANGLES,
  PRINT_TYPES,
  type CategoryPreviewSettings,
  type PreviewTemplate,
  type QikinkMode,
} from './preview-settings';

export interface CategoryPreviewConfigProps {
  categories: readonly { id: string; name: string; slug: string }[];
  canManage: boolean;
}

type Notice = { tone: 'ok' | 'warn' | 'error'; text: string };

const noticeColors: Record<Notice['tone'], { background: string; color: string }> = {
  ok: { background: 'var(--tuw-bg-success, #F3FAF6)', color: 'var(--tuw-text-success, #187343)' },
  warn: { background: 'var(--tuw-bg-warning, #FEFBF5)', color: 'var(--tuw-text-warning, #856300)' },
  error: { background: 'var(--tuw-bg-error, #FEF4F4)', color: 'var(--tuw-text-error, #C91818)' },
};

const smallText: React.CSSProperties = { fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' };

const newTemplate = (): PreviewTemplate => ({
  angle: 'Front',
  imagePath: '/images/pdp-figma/shirt/front.png',
  printType: 1,
  placementCode: 'fr',
  widthInches: 12,
  heightInches: 16,
});

export default function CategoryPreviewConfig({ categories, canManage }: CategoryPreviewConfigProps) {
  const [configs, setConfigs] = useState<Record<string, CategoryPreviewSettings>>({});
  const [selectedId, setSelectedId] = useState(categories[0]?.id ?? '');
  const [templates, setTemplates] = useState<PreviewTemplate[]>([]);
  const [mode, setMode] = useState<QikinkMode | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void personalizationAdminAction({ op: 'load', categoryIds: categories.map((category) => category.id) }).then((result) => {
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error.message });
        return;
      }
      setConfigs(result.data.configs);
      setMode(result.data.mode);
    });
  }, []);

  useEffect(() => {
    setTemplates(configs[selectedId]?.templates.map((template) => ({ ...template })) ?? []);
  }, [selectedId, configs]);

  const update = (index: number, patch: Partial<PreviewTemplate>) => {
    setTemplates((current) => current.map((template, position) => position === index ? { ...template, ...patch } : template));
  };

  const persist = async (settings: CategoryPreviewSettings | null) => {
    if (busy || !canManage || !selectedId) return;
    if (settings && settings.templates.length) {
      const bad = settings.templates.find((template) =>
        !template.angle.trim()
        || !isSafePreviewImagePath(template.imagePath)
        || !PLACEMENT_CODES.includes(template.placementCode as (typeof PLACEMENT_CODES)[number])
        || !PRINT_TYPES.includes(template.printType as (typeof PRINT_TYPES)[number])
        || !(template.widthInches > 0)
        || !(template.heightInches > 0));
      if (bad) {
        setNotice({
          tone: 'error',
          text: `Template "${bad.angle || 'unnamed'}" needs an angle, a /images/pdp-figma/… path, a valid placement, print type and positive inches.`,
        });
        return;
      }
    }
    setBusy(true);
    const result = await personalizationAdminAction({ op: 'save', categoryId: selectedId, settings });
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error.message });
      return;
    }
    setConfigs((current) => ({ ...current, ...result.data.configs }));
    setNotice({
      tone: 'ok',
      text: settings
        ? `Saved ${settings.templates.length} preview template${settings.templates.length === 1 ? '' : 's'} under categories.settings.personalization.`
        : 'Removed the personalization config from this category.',
    });
  };

  if (!canManage || !categories.length) return null;

  const category = categories.find((item) => item.id === selectedId) ?? categories[0]!;

  return (
    <ContentCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Category preview templates</div>
          <p style={{ ...smallText, margin: '4px 0 0' }}>
            Demo-only mockups: one local image and print placement per angle. Saved in categories.settings under the personalization key.
          </p>
          {mode ? <p style={{ ...smallText, margin: '6px 0 0' }}>{mode.notice}</p> : null}
        </div>
        {notice ? (
          <div role={notice.tone === 'error' ? 'alert' : 'status'} style={{ padding: '10px 12px', borderRadius: 8, fontSize: 13, background: noticeColors[notice.tone].background, color: noticeColors[notice.tone].color }}>
            {notice.text}
          </div>
        ) : null}
        <Select
          label="Category"
          value={selectedId}
          options={categories.map((item) => ({ label: `${item.name} (/${item.slug})`, value: item.id }))}
          onChange={(event) => { setSelectedId(event.target.value); setNotice(null); }}
        />
        {templates.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {templates.map((template, index) => (
              <div key={index} style={{ border: '1px solid var(--tuw-border-control, #D1D5DB)', borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <Select
                  label="Angle"
                  value={template.angle}
                  options={PREVIEW_ANGLES.map((angle) => ({ label: angle, value: angle }))}
                  onChange={(event) => update(index, { angle: event.target.value })}
                />
                <Input label="Local mockup path" value={template.imagePath} placeholder="/images/pdp-figma/shirt/front.png" onChange={(event) => update(index, { imagePath: event.target.value })} />
                <Select
                  label="Print type"
                  value={String(template.printType)}
                  options={PRINT_TYPES.map((type) => ({ label: `Type ${type}`, value: String(type) }))}
                  onChange={(event) => update(index, { printType: Number(event.target.value) })}
                />
                <Select
                  label="Placement code"
                  value={template.placementCode}
                  options={PLACEMENT_CODES.map((code) => ({ label: code, value: code }))}
                  onChange={(event) => update(index, { placementCode: event.target.value })}
                />
                <Input label="Width (inches)" type="number" step="0.1" min="0.1" value={String(template.widthInches)} onChange={(event) => update(index, { widthInches: Number(event.target.value) })} />
                <Input label="Height (inches)" type="number" step="0.1" min="0.1" value={String(template.heightInches)} onChange={(event) => update(index, { heightInches: Number(event.target.value) })} />
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button variant="ghost" size="sm" onClick={() => setTemplates((current) => current.filter((_, position) => position !== index))}>Remove angle</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ ...smallText, margin: 0 }}>No preview templates for {category.name} yet.</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Button variant="secondary" size="sm" disabled={templates.length >= 24} onClick={() => setTemplates((current) => [...current, newTemplate()])}>Add angle</Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={() => void persist({ templates })}>{busy ? 'Saving…' : 'Save templates'}</Button>
          <Button variant="danger" size="sm" disabled={busy} onClick={() => { if (window.confirm(`Remove preview templates for ${category.name}?`)) void persist(null); }}>Remove config</Button>
        </div>
      </div>
    </ContentCard>
  );
}
