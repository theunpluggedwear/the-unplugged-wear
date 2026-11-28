'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import Button from '@storefront/components/ui/Button';
import { changePasswordAction } from '@/server/customer-actions';
import { useAccountPage } from '../AccountShell';
import { DetailList, DetailRow, InlineNote, PasswordInput, ProfileCard, type Note } from './parts';

const MIN_PASSWORD = 8;

function Rule({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? 'text-store-success' : 'text-store-text-secondary'}`}>
      {met ? <Check size={13} aria-hidden="true" /> : <Circle size={11} aria-hidden="true" />}
      <span>{children}</span>
      <span className="sr-only">{met ? '(done)' : '(not yet)'}</span>
    </li>
  );
}

/** Sign-in email and password change. */
export default function SecurityCard() {
  const { account } = useAccountPage();
  const email = account.account!.profile.email;

  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const longEnough = next.length >= MIN_PASSWORD;
  const matches = next.length > 0 && next === confirm;

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setErrors({});
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const nextErrors: typeof errors = {};
    if (!current) nextErrors.current = 'Enter your current password.';
    if (!longEnough) nextErrors.next = `Use at least ${MIN_PASSWORD} characters.`;
    if (!matches) nextErrors.confirm = 'The new passwords don’t match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setNote(null);
    try {
      const result = await changePasswordAction({ currentPassword: current, newPassword: next });
      if (!result.ok) {
        setNote({ tone: 'error', text: result.error.message });
        return;
      }
      reset();
      setEditing(false);
      setNote({ tone: 'ok', text: 'Password changed. Other devices were signed out.' });
    } catch {
      setNote({ tone: 'error', text: 'Could not change your password just now. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileCard
      id="security-heading"
      title="Sign-in & security"
      description="The email and password you log in with."
      action={
        !editing && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              reset();
              setNote(null);
              setEditing(true);
            }}
          >
            Change password
          </Button>
        )
      }
    >
      {editing ? (
        <form onSubmit={save} noValidate className="space-y-4 max-w-md">
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => { setCurrent(e.target.value); setErrors((x) => ({ ...x, current: undefined })); }}
            error={errors.current}
          />
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => { setNext(e.target.value); setErrors((x) => ({ ...x, next: undefined })); }}
            error={errors.next}
          />
          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setErrors((x) => ({ ...x, confirm: undefined })); }}
            error={errors.confirm}
          />
          <ul className="space-y-1" aria-label="Password requirements" aria-live="polite">
            <Rule met={longEnough}>At least {MIN_PASSWORD} characters</Rule>
            <Rule met={matches}>Both new passwords match</Rule>
          </ul>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="dark" size="sm" type="submit" disabled={saving}>
              {saving ? 'Changing…' : 'Change password'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { reset(); setEditing(false); }} disabled={saving}>
              Cancel
            </Button>
          </div>
          <InlineNote note={note} />
          <p className="text-xs text-store-text-secondary">
            Forgot your current password?{' '}
            <Link href="/forgot-password?next=%2Faccount%2Fprofile" className="font-medium text-store-charcoal underline underline-offset-4 decoration-store-gold">
              Reset it by email
            </Link>
          </p>
        </form>
      ) : (
        <div className="space-y-4">
          <DetailList>
            <DetailRow label="Sign-in email">{email}</DetailRow>
            <DetailRow label="Password">
              <span aria-label="Password set" className="tracking-widest">••••••••</span>
            </DetailRow>
          </DetailList>
          <InlineNote note={note} />
        </div>
      )}
    </ProfileCard>
  );
}
