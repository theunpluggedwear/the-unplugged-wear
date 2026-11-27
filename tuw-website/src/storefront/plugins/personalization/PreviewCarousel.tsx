'use client';

import React from 'react';
import {
  PREVIEW_ANGLES, previewImageFor, type PreviewAngle, type PreviewFamily,
} from './preview-url';

export interface PreviewCarouselProps {
  family: PreviewFamily;
  angle: PreviewAngle;
  onAngleChange: (angle: PreviewAngle) => void;
  monogram: string;
  previewUrl?: string;
  disabled?: boolean;
}

export default function PreviewCarousel({
  family, angle, onAngleChange, monogram, previewUrl = '', disabled = false,
}: PreviewCarouselProps) {
  const angleImage = previewImageFor(family, angle);
  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-store-text-secondary">Preview angle</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Preview angle">
        {PREVIEW_ANGLES.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={option === angle}
            onClick={() => onAngleChange(option)}
            className={`rounded border px-3 py-1.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-store-gold disabled:cursor-not-allowed disabled:opacity-50 ${option === angle ? 'border-store-gold bg-store-surface text-store-charcoal' : 'border-store-border bg-store-surface text-store-text-secondary hover:border-store-gold'}`}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="relative mt-3 w-full max-w-sm overflow-hidden rounded border border-store-border bg-store-surface">
        <img src={previewUrl || angleImage} alt={`Monogram preview, ${angle} angle`} className="aspect-square w-full object-contain" />
        {!previewUrl && monogram.trim() ? (
          <span className="pointer-events-none absolute inset-x-8 bottom-9 rounded bg-store-surface/95 py-2 text-center font-serif text-xl text-store-charcoal">
            {monogram.trim()}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-store-text-secondary">Demo preview generated locally — no design file is uploaded.</p>
    </div>
  );
}
