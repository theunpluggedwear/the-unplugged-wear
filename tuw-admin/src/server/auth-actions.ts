'use server';

import { cookies } from 'next/headers';
import * as auth from '@tuw/heart/modules/auth';
import { authSchemas } from '@tuw/heart/modules/auth';
import { safeNext } from '@tuw/heart/next/session';
import { guards, session } from './session';
import { limitAuthAttempt } from './auth-rate-limit';




export const loginAction = guards.action({ access: 'public', input: authSchemas.login }, async ({ input }) => {
  const meta = await session.requestMeta();
  await limitAuthAttempt('login', meta.ip, input.email);
  const tokens = await auth.login({ email: input.email, password: input.password, app: 'admin' }, meta);
  await session.setSession(tokens, input.remember ?? false);
  return { next: safeNext(input.next, '/dashboard') };
});

export const forgotPasswordAction = guards.action({ access: 'public', input: authSchemas.forgot }, async ({ input }) => {
  const meta = await session.requestMeta();
  await limitAuthAttempt('forgot', meta.ip, input.email);
  const { devLink } = await auth.requestPasswordReset(input.email, meta, 'admin');
  return { devLink: devLink ?? null };
});

export const resetPasswordAction = guards.action({ access: 'public', input: authSchemas.reset }, async ({ input }) => {
  await limitAuthAttempt('reset', (await session.requestMeta()).ip);
  await auth.resetPassword(input.token, input.password);
  await session.clearSession();
  return { done: true };
});

export const acceptInviteAction = guards.action({ access: 'public', input: authSchemas.acceptInvite }, async ({ input }) => {
  const meta = await session.requestMeta();
  await limitAuthAttempt('invite', meta.ip);
  const tokens = await auth.acceptInvite(input, meta);
  await session.setSession(tokens, true);
  return { next: '/dashboard' };
});

export const logoutAction = guards.action({ access: 'public', input: authSchemas.forgot.partial() }, async () => {
  await auth.logout((await cookies()).get(session.names.refresh)?.value);
  await session.clearSession();
  return { done: true };
});



export const listTeamAction = guards.action({ permission: 'user.manage', input: authSchemas.forgot.partial() }, async () => auth.listStaff());

export const inviteStaffAction = guards.action(
  { permission: 'user.manage', input: authSchemas.invite, idempotent: { scope: 'auth.invite' } },
  async ({ input, ctx }) => auth.inviteStaff({ email: input.email, role: input.role, invitedBy: ctx.user!.id }, await session.requestMeta()),
);

export const revokeInviteAction = guards.action({ permission: 'user.manage', input: authSchemas.revokeInvite }, async ({ input }) => {
  await auth.revokeInvite(input.inviteId);
  return { done: true };
});

export const setStaffRoleAction = guards.action({ permission: 'user.manage', input: authSchemas.setRole }, async ({ input, ctx }) => {
  await auth.setStaffRole(input.userId, input.role, ctx.user!.id);
  return { done: true };
});

export const setStaffStatusAction = guards.action({ permission: 'user.manage', input: authSchemas.setStatus }, async ({ input, ctx }) => {
  await auth.setUserStatus(input.userId, input.status, ctx.user!.id);
  return { done: true };
});
