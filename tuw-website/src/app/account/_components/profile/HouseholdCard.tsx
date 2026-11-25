'use client';

import React, { useState } from 'react';
import { Mail, UserPlus } from 'lucide-react';
import Badge from '@storefront/components/ui/Badge';
import Button from '@storefront/components/ui/Button';
import Input from '@storefront/components/ui/Input';
import Modal from '@storefront/components/ui/Modal';
import { formatShortDate } from '@storefront/lib/format';
import {
  addMemberAction,
  inviteToHouseholdAction,
  leaveHouseholdAction,
  removeMemberAction,
  revokeHouseholdInviteAction,
  setMemberRoleAction,
  updateMemberAction,
} from '@/server/customer-actions';
import type { Household, HouseholdMember } from '@tuw/heart/modules/customers';
import { useAccountPage } from '../AccountShell';
import { InlineNote, ProfileCard, type Note } from './parts';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type Dialog =
  | { kind: 'member'; member: HouseholdMember | null } // null = add
  | { kind: 'invite' }
  | { kind: 'confirm'; action: 'remove' | 'promote' | 'demote'; member: HouseholdMember }
  | { kind: 'confirm'; action: 'leave'; member?: undefined }
  | null;

const newKey = () => `hh-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const initials = (m: HouseholdMember) => `${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`.toUpperCase();

const CONFIRM_COPY = {
  remove: (m?: HouseholdMember) => ({
    title: `Remove ${m?.firstName} from your household?`,
    body: 'Their orders and saved sizes are kept. You won’t be able to order for them from here.',
    cta: 'Remove',
  }),
  leave: () => ({
    title: 'Leave this household?',
    body: 'Your orders and sizes stay with you, and you start your own household. You’ll need a new invite to rejoin.',
    cta: 'Leave household',
  }),
  promote: (m?: HouseholdMember) => ({
    title: `Make ${m?.firstName} a manager?`,
    body: 'Managers can add, edit and remove family members and send invitations.',
    cta: 'Make manager',
  }),
  demote: (m?: HouseholdMember) => ({
    title: `Make ${m?.firstName} a member?`,
    body: 'They’ll keep their login and orders, but can no longer manage the household.',
    cta: 'Make member',
  }),
} as const;

/** Family members you shop for, plus invitations — managers manage, members can leave. */
export default function HouseholdCard() {
  const { account } = useAccountPage();
  const household = account.account!.household;
  const isManager = household.myRole === 'manager';

  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<string[]>([]);
  const invites = (account.account!.invites ?? []).filter((i) => !revoked.includes(i.id));

  // Member form (add / edit) and invite form.
  const [memberForm, setMemberForm] = useState({ firstName: '', lastName: '', dob: '' });
  const [memberError, setMemberError] = useState<string | undefined>();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | undefined>();
  const [inviteKey, setInviteKey] = useState(newKey);

  const open = (next: Dialog) => {
    setDialogError(null);
    setMemberError(undefined);
    setInviteError(undefined);
    if (next?.kind === 'member') {
      setMemberForm({
        firstName: next.member?.firstName ?? '',
        lastName: next.member?.lastName ?? '',
        dob: next.member?.dateOfBirth ?? '',
      });
    }
    if (next?.kind === 'invite') setInviteEmail('');
    setDialog(next);
  };
  const close = () => !busy && setDialog(null);

  /** Runs a household action; on success closes the dialog and reports next to the list. */
  const run = async <T,>(work: () => Promise<ActionResult<T>>, onOk: (data: T) => string | Note) => {
    if (busy) return;
    setBusy(true);
    setDialogError(null);
    try {
      const result = await work();
      if (!result.ok) {
        // Keep the dialog (and anything typed) open with the reason.
        setDialogError(result.error.message);
        return;
      }
      const message = onOk(result.data);
      setNote(typeof message === 'string' ? { tone: 'ok', text: message } : message);
      setDialog(null);
    } catch {
      setDialogError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const applyHousehold = (h: Household) => account.setHousehold(h);

  const submitMember = (event: React.FormEvent) => {
    event.preventDefault();
    if (dialog?.kind !== 'member') return;
    if (!memberForm.firstName.trim()) return setMemberError('Enter their first name.');
    const input = { firstName: memberForm.firstName.trim(), lastName: memberForm.lastName.trim(), dateOfBirth: memberForm.dob || null };
    const editing = dialog.member;
    void run(
      () => (editing ? updateMemberAction({ profileId: editing.profileId, ...input }) : addMemberAction(input)),
      (h) => {
        applyHousehold(h);
        return editing ? `${input.firstName}’s details are saved.` : `${input.firstName} was added. You can now order for them.`;
      },
    );
  };

  const submitInvite = (event: React.FormEvent) => {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setInviteError('Enter a valid email address, like name@example.com.');
    void run(
      () => inviteToHouseholdAction({ email, idempotencyKey: inviteKey }),
      (r) => {
        setInviteKey(newKey());
        return r.devLink
          ? { tone: 'ok', text: `Invitation created for ${email}. Email is not connected yet (development):`, link: r.devLink }
          : { tone: 'ok', text: `Invitation sent to ${email}. It shows here once you reload.` };
      },
    );
  };

  const confirmAction = () => {
    if (dialog?.kind !== 'confirm') return;
    const m = dialog.member;
    if (dialog.action === 'leave') {
      void run(() => leaveHouseholdAction({}), (h) => { applyHousehold(h); return 'You left the household. Your orders and sizes stay with you.'; });
    } else if (dialog.action === 'remove' && m) {
      void run(() => removeMemberAction({ profileId: m.profileId }), (h) => { applyHousehold(h); return `${m.firstName} was removed. Their orders and sizes are kept.`; });
    } else if (m) {
      const role = dialog.action === 'promote' ? 'manager' : 'member';
      void run(() => setMemberRoleAction({ profileId: m.profileId, role }), (h) => {
        applyHousehold(h);
        return role === 'manager' ? `${m.firstName} is now a manager.` : `${m.firstName} is now a member.`;
      });
    }
  };

  const confirmCopy = dialog?.kind === 'confirm' ? CONFIRM_COPY[dialog.action](dialog.member) : null;

  return (
    <ProfileCard
      id="household-heading"
      title="Household"
      description="Shop for family members and keep their sizes in one place. Addresses stay private to each person."
      action={
        isManager && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => open({ kind: 'member', member: null })}>
              <UserPlus size={14} aria-hidden="true" /> Add family member
            </Button>
            <Button variant="secondary" size="sm" onClick={() => open({ kind: 'invite' })}>
              <Mail size={14} aria-hidden="true" /> Invite by email
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        <ul className="divide-y divide-store-card-border -my-3" aria-label="Household members">
          {household.members.map((m) => (
            <li key={m.profileId} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span
                aria-hidden="true"
                className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-medium ${m.isMe ? 'bg-store-charcoal text-white' : 'bg-store-cream text-store-charcoal'}`}
              >
                {initials(m)}
              </span>
              <div className="flex-1 min-w-[10rem]">
                <p className="text-sm font-medium text-store-charcoal">
                  {m.firstName} {m.lastName}
                  {m.isMe && <span className="font-normal text-store-text-secondary"> · you</span>}
                </p>
                <p className="text-xs text-store-text-secondary">
                  {m.canLogIn ? 'Has their own login' : 'Managed by the household — no login'}
                  {m.dateOfBirth ? ` · born ${formatShortDate(m.dateOfBirth)}` : ''}
                </p>
              </div>
              <Badge variant={m.role === 'manager' ? 'dark' : 'neutral'} size="sm">
                {m.role === 'manager' ? 'Manager' : 'Member'}
              </Badge>
              {isManager && !m.isMe && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
                  {!m.canLogIn && (
                    <button type="button" onClick={() => open({ kind: 'member', member: m })} className="text-store-charcoal underline-offset-4 hover:underline cursor-pointer py-1">
                      Edit<span className="sr-only"> {m.firstName}</span>
                    </button>
                  )}
                  {m.canLogIn && m.role === 'member' && (
                    <button type="button" onClick={() => open({ kind: 'confirm', action: 'promote', member: m })} className="text-store-charcoal underline-offset-4 hover:underline cursor-pointer py-1">
                      Make manager<span className="sr-only">: {m.firstName}</span>
                    </button>
                  )}
                  {m.role === 'manager' && (
                    <button type="button" onClick={() => open({ kind: 'confirm', action: 'demote', member: m })} className="text-store-charcoal underline-offset-4 hover:underline cursor-pointer py-1">
                      Make member<span className="sr-only">: {m.firstName}</span>
                    </button>
                  )}
                  <button type="button" onClick={() => open({ kind: 'confirm', action: 'remove', member: m })} className="text-store-text-secondary hover:text-store-terracotta underline-offset-4 hover:underline cursor-pointer py-1">
                    Remove<span className="sr-only"> {m.firstName}</span>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {household.members.length === 1 && (
          <p className="text-sm text-store-text-secondary">
            {isManager ? 'It’s just you for now. Add a child or partner you order for, or invite someone who has their own account.' : 'It’s just you in this household.'}
          </p>
        )}

        {isManager && invites.length > 0 && (
          <div className="pt-3 border-t border-store-card-border">
            <p className="text-xs uppercase tracking-wider text-store-text-secondary mb-2">Pending invitations</p>
            <ul className="space-y-2" aria-label="Pending invitations">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-store-charcoal break-all">{i.email}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(() => revokeHouseholdInviteAction({ inviteId: i.id }), () => {
                        setRevoked((r) => [...r, i.id]);
                        return `Invitation for ${i.email} revoked.`;
                      })
                    }
                    className="shrink-0 text-xs font-medium text-store-text-secondary hover:text-store-terracotta underline-offset-4 hover:underline cursor-pointer disabled:opacity-60"
                  >
                    Revoke<span className="sr-only"> invitation for {i.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <InlineNote note={note} />
        {dialog === null && dialogError && <InlineNote note={{ tone: 'error', text: dialogError }} />}

        {household.members.length > 1 && (
          <div className="pt-3 border-t border-store-card-border">
            <button
              type="button"
              onClick={() => open({ kind: 'confirm', action: 'leave' })}
              className="text-sm font-medium text-store-text-secondary hover:text-store-terracotta underline-offset-4 hover:underline cursor-pointer"
            >
              Leave household
            </button>
          </div>
        )}
      </div>

      {/* Add / edit a family member */}
      <Modal
        isOpen={dialog?.kind === 'member'}
        onClose={close}
        title={dialog?.kind === 'member' && dialog.member ? `Edit ${dialog.member.firstName}` : 'Add a family member'}
        subtitle="Someone you order for who doesn’t need their own login."
      >
        <form onSubmit={submitMember} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First name"
              value={memberForm.firstName}
              onChange={(e) => { setMemberForm((f) => ({ ...f, firstName: e.target.value })); setMemberError(undefined); }}
              error={memberError}
              required
            />
            <Input label="Last name" value={memberForm.lastName} onChange={(e) => setMemberForm((f) => ({ ...f, lastName: e.target.value }))} />
          </div>
          <Input label="Date of birth (optional)" type="date" value={memberForm.dob} onChange={(e) => setMemberForm((f) => ({ ...f, dob: e.target.value }))} helperText="Helps suggest kids’ sizes." />
          {dialogError && <InlineNote note={{ tone: 'error', text: dialogError }} />}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="md" onClick={close} disabled={busy}>Cancel</Button>
            <Button variant="dark" size="md" type="submit" disabled={busy}>
              {busy ? 'Saving…' : dialog?.kind === 'member' && dialog.member ? 'Save' : 'Add member'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Invite by email */}
      <Modal isOpen={dialog?.kind === 'invite'} onClose={close} title="Invite by email" subtitle="For someone who has, or will create, their own account.">
        <form onSubmit={submitInvite} noValidate className="space-y-4">
          <Input
            label="Their email"
            type="email"
            placeholder="name@example.com"
            value={inviteEmail}
            onChange={(e) => { setInviteEmail(e.target.value); setInviteError(undefined); }}
            error={inviteError}
            autoComplete="off"
          />
          {dialogError && <InlineNote note={{ tone: 'error', text: dialogError }} />}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="md" onClick={close} disabled={busy}>Cancel</Button>
            <Button variant="dark" size="md" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send invite'}</Button>
          </div>
        </form>
      </Modal>

      {/* Confirm remove / leave / role change */}
      <Modal isOpen={dialog?.kind === 'confirm'} onClose={close} title={confirmCopy?.title}>
        <div className="space-y-5">
          <p className="text-sm text-store-text-secondary">{confirmCopy?.body}</p>
          {dialogError && <InlineNote note={{ tone: 'error', text: dialogError }} />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="md" onClick={close} disabled={busy}>Keep as is</Button>
            <Button
              variant={dialog?.kind === 'confirm' && (dialog.action === 'remove' || dialog.action === 'leave') ? 'danger' : 'dark'}
              size="md"
              onClick={confirmAction}
              disabled={busy}
            >
              {busy ? 'Working…' : confirmCopy?.cta}
            </Button>
          </div>
        </div>
      </Modal>
    </ProfileCard>
  );
}
