'use client';

import React, { useReducer, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import Breadcrumb from '@storefront/components/ui/Breadcrumb';
import Input from '@storefront/components/ui/Input';
import Button from '@storefront/components/ui/Button';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { resetPasswordAction } from '@/server/auth-actions';
import { asyncReducer, initialAsync } from '@storefront/lib/async-state';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [request, dispatchRequest] = useReducer(asyncReducer<string | null>, initialAsync);
  const success = request.kind === 'success';
  const error = request.kind === 'error' ? request.message : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      dispatchRequest({ type: 'FAIL', message: 'Password must contain at least 8 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      dispatchRequest({ type: 'FAIL', message: 'Passwords do not match.' });
      return;
    }

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      dispatchRequest({ type: 'FAIL', message: 'Open the reset link from your email to set a new password.' });
      return;
    }
    dispatchRequest({ type: 'START' });
    try {
      const result = await resetPasswordAction({ token, password });
      if (!result.ok) {
        dispatchRequest({ type: 'FAIL', message: result.error.message });
        return;
      }
      setPassword('');
      setConfirmPassword('');
      dispatchRequest({ type: 'SUCCESS', data: null });
    } catch (cause) {
      dispatchRequest({ type: 'FAIL', message: cause instanceof Error ? cause.message : 'Could not reset the password.' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
      <Header />

      <main className="flex-1 max-w-md mx-auto px-4 py-12 sm:py-20 w-full">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Set New Password' },
          ]}
        />

        <div className="bg-white rounded-3xl border border-[#E2DDCF] p-8 shadow-xs my-6 space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="tuw-h1 text-store-charcoal">
              Set New Password
            </h1>
            <p className="text-xs text-[#666]">
              Choose a strong, unique password for your account.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-base font-bold text-store-charcoal">Password Successfully Updated</h3>
              <p className="text-xs text-[#666] leading-relaxed">
                Your credentials have been updated in this simulated session.
              </p>
              <div className="pt-2">
                <Button variant="dark" size="md" href="/login">
                  Sign In with New Password
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <Button
                variant="dark"
                size="lg"
                fullWidth
                type="submit"
                isLoading={request.kind === 'loading'}
              >
                Update Password
              </Button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
