'use client';

import React, { useState } from 'react';
import Badge from '@storefront/components/ui/Badge';
import Button from '@storefront/components/ui/Button';
import Input from '@storefront/components/ui/Input';
import { formatShortDate } from '@storefront/lib/format';
import { resendVerificationEmailAction } from '@/server/auth-actions';
import { useAccountPage } from '../AccountShell';
import { DetailList, DetailRow, InlineNote, ProfileCard, isIndianMobile, type Note } from './parts';

type Form = { firstName: string; lastName: string; phone: string; dob: string };

/** Name, email, mobile and birthday: read first, Edit opens the form. */
export default function PersonalDetailsCard() {
  const { account } = useAccountPage();
  const profile = account.account!.profile;

  const saved: Form = {
    firstName: profile.firstName,
    lastName: profile.lastName ?? '',
    phone: profile.phone ?? '',
    dob: profile.dateOfBirth ?? '',
  };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(saved);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<Note>(null);

  const changed = (Object.keys(saved) as (keyof Form)[]).some((k) => form[k].trim() !== saved[k]);
  const update = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }));
  };

  const startEdit = () => {
    setForm(saved);
    setErrors({});
    setNote(null);
    setEditing(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !changed) return;
    const nextErrors: typeof errors = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'Enter your first name.';
    if (form.phone.trim() && !isIndianMobile(form.phone)) nextErrors.phone = 'Enter a 10-digit Indian mobile number, like 98765 43210.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setNote(null);
    const outcome = await account.updateProfile({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || null,
      dateOfBirth: form.dob || null,
    });
    setSaving(false);
    if (!outcome.ok) {
      // Keep everything typed; say what went wrong next to the button.
      setNote({ tone: 'error', text: outcome.message });
      return;
    }
    setEditing(false);
    setNote({ tone: 'ok', text: 'Your details are saved.' });
  };

  const resend = async () => {
    if (resending) return;
    setResending(true);
    setResendNote(null);
    try {
      const result = await resendVerificationEmailAction({});
      if (!result.ok) setResendNote({ tone: 'error', text: result.error.message });
      else if (result.data.alreadyVerified) setResendNote({ tone: 'ok', text: 'Your email is already confirmed. Refresh to see it.' });
      else if (result.data.devLink) setResendNote({ tone: 'ok', text: 'Email is not connected yet (development). Open this link to confirm:', link: result.data.devLink });
      else if (result.data.delivered) setResendNote({ tone: 'ok', text: 'We sent a new confirmation link. Check your inbox.' });
      else setResendNote({ tone: 'ok', text: 'Demo mode: no email was sent. The confirmation link is printed in the server log.' });
    } catch {
      setResendNote({ tone: 'error', text: 'Could not send the link just now. Please try again.' });
    } finally {
      setResending(false);
    }
  };

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');

  return (
    <ProfileCard
      id="personal-heading"
      title="Personal details"
      description="How we address you and reach you about your orders."
      action={
        !editing && (
          <Button variant="secondary" size="sm" onClick={startEdit} aria-label="Edit personal details">
            Edit
          </Button>
        )
      }
    >
      {editing ? (
        <form onSubmit={save} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="First name" value={form.firstName} onChange={(e) => update({ firstName: e.target.value })} autoComplete="given-name" error={errors.firstName} required />
            <Input label="Last name" value={form.lastName} onChange={(e) => update({ lastName: e.target.value })} autoComplete="family-name" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Mobile"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              value={form.phone}
              onChange={(e) => update({ phone: e.target.value })}
              error={errors.phone}
              helperText="For delivery updates. Optional."
            />
            <Input label="Date of birth (optional)" type="date" value={form.dob} onChange={(e) => update({ dob: e.target.value })} />
          </div>
          <p className="text-xs text-store-text-secondary">Your email is your sign-in, so it can’t be changed here.</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="dark" size="sm" type="submit" disabled={saving || !changed}>
              {saving ? 'Saving…' : 'Save details'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <InlineNote note={note} />
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <DetailList>
            <DetailRow label="Name">{fullName}</DetailRow>
            <DetailRow label="Email">
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>{profile.email}</span>
                <Badge variant={profile.emailVerified ? 'outline' : 'warning'} size="sm">
                  {profile.emailVerified ? 'Confirmed' : 'Not confirmed'}
                </Badge>
              </span>
              {!profile.emailVerified && (
                <span className="mt-2 flex flex-col gap-1.5 items-start">
                  <button
                    type="button"
                    onClick={() => void resend()}
                    disabled={resending}
                    className="text-sm font-medium text-store-charcoal underline underline-offset-4 decoration-store-gold hover:decoration-store-charcoal cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  >
                    {resending ? 'Sending…' : 'Resend confirmation link'}
                  </button>
                  <InlineNote note={resendNote} />
                </span>
              )}
            </DetailRow>
            <DetailRow label="Mobile">
              {profile.phone ? (
                // Shown the way it's typed: 98765 43210 (keeps any +91 prefix).
                profile.phone.replace(/^(\+91)?(\d{5})(\d{5})$/, (_, cc: string | undefined, a: string, b: string) => `${cc ? `${cc} ` : ''}${a} ${b}`)
              ) : (
                <span className="text-store-text-secondary">Not added</span>
              )}
            </DetailRow>
            <DetailRow label="Date of birth">
              {profile.dateOfBirth ? formatShortDate(profile.dateOfBirth) : <span className="text-store-text-secondary">Not added</span>}
            </DetailRow>
          </DetailList>
          <InlineNote note={note} />
        </div>
      )}
    </ProfileCard>
  );
}
