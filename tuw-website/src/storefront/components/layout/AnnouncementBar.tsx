'use client';
import { formatRupees } from '@storefront/lib/format';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@storefront/mocks/store';

export default function AnnouncementBar() {
  const { freeShippingRemaining, freeShippingThreshold, cartSubtotal } = useStore();

  return (
    <div className="bg-[#1A1A1A] text-white py-2 px-4 text-center text-xs tracking-wider uppercase font-medium flex items-center justify-center gap-2 select-none">
      {cartSubtotal > 0 && freeShippingRemaining > 0 ? (
        <span>
          Add <strong className="text-[#C8A96A]">{formatRupees(freeShippingRemaining)}</strong> more for complimentary delivery
        </span>
      ) : cartSubtotal > 0 && freeShippingRemaining === 0 ? (
        <span className="text-[#A7F3D0]">
          ✓ You have qualified for complimentary domestic delivery
        </span>
      ) : (
        <span>
          Complimentary domestic delivery over {formatRupees(freeShippingThreshold)} • Printed to order in Tiruppur
        </span>
      )}
    </div>
  );
}
