'use server';

import * as content from '@tuw/heart/modules/content';
import { contentSchemas as s } from '@tuw/heart/modules/content';
import { guards } from './session';
import { refreshStorefront } from './storefront-cache';

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

export const listMediaAction = guards.action({ permission: 'content.manage', input: s.listMedia }, ({ input, ctx }) =>
  content.adminListMedia(input.usage, ctx.user!.id));

export const saveMediaAction = guards.action({ permission: 'content.manage', input: s.saveMedia }, ({ input, ctx }) =>
  content.adminSaveMedia(input, ctx.user!.id));

export const deleteMediaAction = guards.action({ permission: 'content.manage', input: s.mediaRef }, ({ input, ctx }) =>
  content.adminDeleteMedia(input.id, ctx.user!.id));

export const listSectionsAction = guards.action({ permission: 'content.manage', input: s.listSections }, ({ input, ctx }) =>
  content.adminListSections(input.pageKey, ctx.user!.id));

export const saveSectionAction = guards.action({ permission: 'content.manage', input: s.saveSection }, async ({ input, ctx }) => {
  const result = await content.adminSaveSection(input, ctx.user!.id);
  await refreshStorefront(['cms:home']);
  return result;
});

export const deleteSectionAction = guards.action({ permission: 'content.manage', input: s.sectionRef }, async ({ input, ctx }) => {
  const result = await content.adminDeleteSection(input.id, ctx.user!.id);
  await refreshStorefront(['cms:home']);
  return result;
});

export const listDesignsAction = guards.action({ permission: 'content.manage', input: s.listDesigns }, ({ input, ctx }) =>
  content.adminListDesigns(input, ctx.user!.id));

export const saveDesignAction = guards.action({ permission: 'content.manage', input: s.saveDesign }, ({ input, ctx }) =>
  content.adminSaveDesign(input, ctx.user!.id));

export const deleteDesignAction = guards.action({ permission: 'content.manage', input: s.designRef }, ({ input, ctx }) =>
  content.adminDeleteDesign(input.id, ctx.user!.id));
