'use client';

import React from 'react';
import { Heart } from 'lucide-react';
import ProductGrid from '@storefront/components/commerce/ProductGrid';
import Button from '@storefront/components/ui/Button';
import { useStore } from '@storefront/mocks/store';

/** /account/wishlist — pieces the shopper saved with the heart. */
export default function WishlistSection() {
  const { wishlist, products } = useStore();
  const saved = products.filter((p) => wishlist.includes(p.id));

  return (
    <section aria-labelledby="wishlist-heading" className="space-y-5">
      <div>
        <h2 id="wishlist-heading" className="font-heading text-xl font-medium text-store-charcoal">
          Wishlist
        </h2>
        <p className="text-sm text-store-text-secondary mt-1">
          {saved.length === 0
            ? 'Pieces you save with the heart appear here.'
            : `${saved.length} saved piece${saved.length === 1 ? '' : 's'}. Each is printed only after you order it.`}
        </p>
      </div>

      {saved.length === 0 ? (
        <div className="py-16 text-center border border-store-card-border bg-store-surface px-6">
          <Heart size={26} aria-hidden="true" className="mx-auto text-store-text-secondary" />
          <h3 className="mt-4 font-heading text-lg font-medium text-store-charcoal">Nothing saved yet</h3>
          <p className="mt-2 text-sm text-store-text-secondary max-w-md mx-auto">
            Tap the heart on any piece to keep it here for later.
          </p>
          <div className="mt-6">
            <Button variant="dark" size="md" href="/shop">
              Explore the collection
            </Button>
          </div>
        </div>
      ) : (
        // Three across at most: the account column is narrower than the shop.
        <ProductGrid products={saved} className="xl:grid-cols-3!" />
      )}
    </section>
  );
}
