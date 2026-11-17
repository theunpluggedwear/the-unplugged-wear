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

export const listFaqsAction = guards.action({ permission: 'content.manage', input: s.faqList }, ({ ctx }) =>
  content.adminListFaqs(ctx.user!.id));

export const saveFaqAction = guards.action({ permission: 'content.manage', input: s.saveFaq }, ({ input, ctx }) =>
  content.adminSaveFaq(input, ctx.user!.id));

export const deleteFaqAction = guards.action({ permission: 'content.manage', input: s.faqRef }, ({ input, ctx }) =>
  content.adminDeleteFaq(input.id, ctx.user!.id));
