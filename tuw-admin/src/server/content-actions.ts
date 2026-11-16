'use server';

import * as content from '@tuw/heart/modules/content';
import { contentSchemas as s } from '@tuw/heart/modules/content';
import { guards } from './session';

export const listPagesAction = guards.action({ permission: 'content.manage', input: s.listPages }, ({ ctx }) =>
  content.adminListPages(ctx.user!.id));

export const savePageAction = guards.action({ permission: 'content.manage', input: s.savePage }, ({ input, ctx }) =>
  content.adminSavePage(input, ctx.user!.id));

export const getNavigationAction = guards.action({ permission: 'content.manage', input: s.getNavigationInput }, ({ ctx }) =>
  content.adminGetNavigation(ctx.user!.id));

export const saveNavigationAction = guards.action({ permission: 'content.manage', input: s.saveNavigation }, ({ input, ctx }) =>
  content.adminSaveNavigation(input.navbar, ctx.user!.id));
