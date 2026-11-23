'use server';

import { z } from 'zod';
import { guards } from './session';

export const getCurrentStaffAction = guards.action({
  permission: 'order.view',
  input: z.object({}),
}, async ({ ctx }) => ({
  name: ctx.user!.email.split('@')[0] ?? 'Staff',
  email: ctx.user!.email,
  roles: ctx.user!.roles,
  permissions: ctx.user!.permissions,
}));
