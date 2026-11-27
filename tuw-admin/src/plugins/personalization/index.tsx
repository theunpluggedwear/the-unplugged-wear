'use client';

import React from 'react';
import { DrawerCard, Input, Switch } from '@/components/ui';
import { pairedFieldGrid } from '@/app/(dashboard)/products/_components/editor/sections/constants';

export interface PersonalizationDisplayOptionProps {
  visible: boolean;
  onChange: (visible: boolean) => void;
}

export function PersonalizationDisplayOption({ visible, onChange }: PersonalizationDisplayOptionProps) {
  return (
    <Switch
      label="Monogram & embroidery"
      description="Show the custom embroidery block below"
      checked={visible}
      onChange={onChange}
    />
  );
}

export interface PersonalizationMonogramCardProps {
  visible: boolean;
  cardOpen: boolean;
  onCardToggle: (open: boolean) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  maxChars: string;
  onMaxCharsChange: (value: string) => void;
  upcharge: string;
  onUpchargeChange: (value: string) => void;
}

export function PersonalizationMonogramCard({
  visible, cardOpen, onCardToggle, enabled, onEnabledChange, maxChars, onMaxCharsChange, upcharge, onUpchargeChange,
}: PersonalizationMonogramCardProps) {
  if (!visible) return null;
  return (
    <DrawerCard
      title="4. Monogram & custom embroidery"
      description="On-demand chest initials and their upcharge"
      collapsible
      isOpen={cardOpen}
      onToggle={onCardToggle}
      bodyGap={16}
    >
      <div data-field="monogram">
        <Switch
          label="Offer monogramming"
          description="On-demand chest initials with upcharge"
          checked={enabled}
          onChange={onEnabledChange}
        />
      </div>
      {enabled ? (
        <div style={pairedFieldGrid}>
          <Input label="Max Characters" type="number" value={maxChars} onChange={(e) => onMaxCharsChange(e.target.value)} />
          <Input label="Upcharge (₹)" type="number" step="0.01" value={upcharge} onChange={(e) => onUpchargeChange(e.target.value)} />
        </div>
      ) : null}
    </DrawerCard>
  );
}

export const personalizationAdminPlugin = { id: 'personalization', slots: ['specsDisplay', 'specsMonogram'] };
