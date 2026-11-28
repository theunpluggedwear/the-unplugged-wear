'use client';

import React from 'react';
import Button from '@storefront/components/ui/Button';
import Badge from '@storefront/components/ui/Badge';
import { useStore } from '@storefront/mocks/store';
import type { CartItem } from '@storefront/lib/types';

export interface BagPreviewProps {
  item: CartItem;
}

export default function BagPreview({ item }: BagPreviewProps) {
  const { approvePreviewFor } = useStore();
  if (!item.previewImageUrl || item.productKind === 'gift_card') return null;
  return (
    <div className="mt-2 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.previewImageUrl} alt="Monogram preview" className="h-12 w-12 rounded border border-store-border object-cover" />
      <div className="min-w-0 text-xs text-store-text-secondary">
        <p className="truncate">Monogram{item.monogram ? `: ${item.monogram}` : ''}{item.placement ? ` · ${item.placement}` : ''}</p>
        <p className="mt-0.5">Demo preview generated locally — no design file is uploaded.</p>
      </div>
      {item.previewApproved ? (
        <Badge variant="success">Preview approved</Badge>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={() => void approvePreviewFor(item.id)}>
          Approve preview
        </Button>
      )}
    </div>
  );
}
