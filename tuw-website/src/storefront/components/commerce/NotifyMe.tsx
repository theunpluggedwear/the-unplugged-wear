'use client';

import React, { useReducer, useState } from 'react';
import { notifyMeAction } from '@/server/catalog-actions';
import { asyncReducer, initialAsync } from '@storefront/lib/async-state';
import Button from '@storefront/components/ui/Button';
import Input from '@storefront/components/ui/Input';

export interface NotifyMeProps {
  productId: string;
  color?: string;
  size: string;
}

/** "Notify me" for a sold-out option. Keeps what was typed if the request fails. */
export default function NotifyMe({ productId, color, size }: NotifyMeProps) {
  const [email, setEmail] = useState('');
  const [request, dispatchRequest] = useReducer(asyncReducer<null>, initialAsync);
  const error = request.kind === 'error' ? request.message : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    dispatchRequest({ type: 'START' });
    try {
      const result = await notifyMeAction({ productId, color, size, email });
      if (result.ok) {
        dispatchRequest({ type: 'SUCCESS', data: null });
        return;
      }
      dispatchRequest({ type: 'FAIL', message: result.error.details[0]?.message ?? result.error.message });
    } catch (cause) {
      dispatchRequest({ type: 'FAIL', message: cause instanceof Error ? cause.message : 'Could not save your request.' });
    }
  };

  if (request.kind === 'success') {
    return (
      <p role="status" className="p-4 bg-store-cream border border-store-card-border text-sm text-store-charcoal">
        We&rsquo;ll let you know at {email} when {size} is back. Demo: no email is sent until the email provider is connected.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="p-4 bg-store-cream border border-store-card-border space-y-3">
      <p className="text-sm font-medium text-store-charcoal">Sold out in {size}. Get an email when it&rsquo;s back.</p>
      <Input
        id="notify-me-email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error ?? undefined}
      />
      <Button type="submit" variant="dark" size="md" fullWidth disabled={request.kind === 'loading'}>
        {request.kind === 'loading' ? 'Saving…' : 'Notify me'}
      </Button>
    </form>
  );
}
