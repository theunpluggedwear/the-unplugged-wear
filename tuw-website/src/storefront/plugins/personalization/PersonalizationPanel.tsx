'use client';

import React, { useEffect, useReducer } from 'react';
import Button from '@storefront/components/ui/Button';
import Input from '@storefront/components/ui/Input';
import { useStore } from '@storefront/mocks/store';
import {
  personalizationReducer, initialPersonalizationState,
} from './personalization-machine';
import { previewUrlFor, validateMonogram } from './preview-url';

export interface PersonalizationPanelProps {
  productId: string;
  maxChars: number;
  printAreas?: string[];
  color?: string;
  size?: string;
  productName: string;
  priceINR: number;
  image: string;
  disabled?: boolean;
  onActiveChange?: (active: boolean) => void;
  onAdded?: () => void;
}

export default function PersonalizationPanel({
  productId, maxChars, printAreas, color, size, productName, priceINR, image, disabled, onActiveChange, onAdded,
}: PersonalizationPanelProps) {
  const { addPersonalisedToCart, approvePreviewFor, setIsCartDrawerOpen } = useStore();
  const [state, dispatch] = useReducer(personalizationReducer, initialPersonalizationState);
  const active = state.kind !== 'inactive';
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
  const areas = printAreas?.length ? printAreas : ['Front'];
  const monogram = 'monogram' in state ? state.monogram : '';
  const placement = 'placement' in state ? state.placement : '';
  const previewUrl = 'previewUrl' in state ? state.previewUrl : '';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state.kind !== 'editing' && state.kind !== 'error') return;
    const error = validateMonogram(state.monogram, maxChars);
    if (error) { dispatch({ type: 'INVALID', message: error }); return; }
    const previewUrl = previewUrlFor({ productId, color, size, monogram: state.monogram, placement: state.placement || areas[0] });
    dispatch({ type: 'RENDER', previewUrl });
  };

  const add = async () => {
    if (state.kind !== 'previewing') return;
    dispatch({ type: 'ADD' });
    const lineId = await addPersonalisedToCart({
      productId, title: productName, color: color ?? 'Standard', size: size ?? 'One size',
      priceINR, quantity: 1, image, monogram: state.monogram, placement: state.placement || areas[0],
      previewImageUrl: state.previewUrl, previewApproved: false,
    });
    if (!lineId) { dispatch({ type: 'FAIL', message: 'Your monogram was not added. Please try again.' }); return; }
    const approved = await approvePreviewFor(lineId);
    if (!approved) { dispatch({ type: 'FAIL', message: 'Added — please approve the preview in your bag.' }); return; }
    dispatch({ type: 'APPROVED', lineId });
    onAdded?.();
    setIsCartDrawerOpen(true);
  };

  return (
    <div className="mt-6 border-t border-store-border pt-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-store-charcoal">Make it yours</p>
          <p className="mt-1 text-xs text-store-text-secondary">Add a monogram and approve the print preview before it goes in your bag.</p>
        </div>
        {!active ? (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => dispatch({ type: 'ENABLE' })}>
            Add monogram
          </Button>
        ) : null}
      </div>

      {active ? (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <Input
            label="Monogram"
            value={monogram}
            maxLength={maxChars}
            disabled={state.kind !== 'editing' && state.kind !== 'error'}
            helperText={`1–${maxChars} characters`}
            error={state.kind === 'editing' ? state.error ?? undefined : undefined}
            onChange={(e) => dispatch({ type: 'SET_MONOGRAM', value: e.target.value })}
          />
          <label className="block text-xs text-store-text-secondary" htmlFor="personalization-placement">Placement</label>
          <select
            id="personalization-placement"
            value={placement}
            disabled={state.kind !== 'editing' && state.kind !== 'error'}
            onChange={(e) => dispatch({ type: 'SET_PLACEMENT', value: e.target.value })}
            className="w-full rounded border border-store-border bg-white px-3 py-2 text-sm text-store-charcoal"
          >
            {areas.map((area) => <option key={area} value={area}>{area}</option>)}
          </select>

          {(state.kind === 'previewing' || state.kind === 'adding' || state.kind === 'error' || state.kind === 'approved') ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Monogram print preview" className="h-20 w-20 rounded border border-store-border object-cover" />
              <p className="text-xs text-store-text-secondary">Demo preview generated locally — no design file is uploaded.</p>
            </div>
          ) : null}

          {state.kind === 'error' ? <p role="alert" className="text-sm text-store-error">{state.message}</p> : null}
          {state.kind === 'approved' ? <p role="status" className="text-sm text-store-charcoal">Preview approved and added to your bag.</p> : null}

          <div className="flex gap-3">
            {state.kind === 'editing' || state.kind === 'error' ? (
              <Button type="submit" variant="dark" size="md">Preview monogram</Button>
            ) : null}
            {state.kind === 'previewing' || state.kind === 'error' ? (
              <Button type="button" variant="dark" size="md" onClick={add}>
                Approve preview &amp; add to bag
              </Button>
            ) : null}
            {active && state.kind !== 'approved' ? (
              <Button type="button" variant="ghost" size="md" onClick={() => dispatch({ type: 'RESET' })}>Remove monogram</Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
