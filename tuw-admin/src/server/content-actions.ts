'use server';

import * as content from '@tuw/heart/modules/content';
import { contentSchemas as s, CMS_TAGS, FAQ_TAG } from '@tuw/heart/modules/content';
import { guards } from './session';
import { refreshStorefront } from './storefront-cache';

// A write that changes what shoppers see asks the separately deployed
// storefront to expire the matching tag. The refresh result is returned next
// to the saved record (never silently discarded) so the UI can report a stale
// storefront instead of claiming everything is up to date.
const refresh = (tag: string) => refreshStorefront([tag]);

export const listPagesAction = guards.action({ permission: 'content.manage', input: s.listPages }, ({ ctx }) =>
  content.adminListPages(ctx.user!.id));

export const savePageAction = guards.action({ permission: 'content.manage', input: s.savePage }, async ({ input, ctx }) => {
  const page = await content.adminSavePage(input, ctx.user!.id);
  return { page, storefront: await refresh(CMS_TAGS.pages) };
});

export const getNavigationAction = guards.action({ permission: 'content.manage', input: s.getNavigationInput }, ({ ctx }) =>
  content.adminGetNavigation(ctx.user!.id));

export const saveNavigationAction = guards.action({ permission: 'content.manage', input: s.saveNavigation }, async ({ input, ctx }) => {
  const navbar = await content.adminSaveNavigation(input.navbar, ctx.user!.id);
  return { navbar, storefront: await refresh(CMS_TAGS.nav) };
});

export const getMobileNavAction = guards.action({ permission: 'content.manage', input: s.getNavigationInput }, ({ ctx }) =>
  content.adminGetMobileNav(ctx.user!.id));

export const saveMobileNavAction = guards.action({ permission: 'content.manage', input: s.saveMobileNav }, async ({ input, ctx }) => {
  const items = await content.adminSaveMobileNav(input.items, ctx.user!.id);
  return { items, storefront: await refresh(CMS_TAGS.nav) };
});

export const listFaqsAction = guards.action({ permission: 'content.manage', input: s.faqList }, ({ ctx }) =>
  content.adminListFaqs(ctx.user!.id));

export const saveFaqAction = guards.action({ permission: 'content.manage', input: s.saveFaq }, async ({ input, ctx }) => {
  const faq = await content.adminSaveFaq(input, ctx.user!.id);
  return { faq, storefront: await refresh(FAQ_TAG) };
});

export const deleteFaqAction = guards.action({ permission: 'content.manage', input: s.faqRef }, async ({ input, ctx }) => {
  await content.adminDeleteFaq(input.id, ctx.user!.id);
  return { storefront: await refresh(FAQ_TAG) };
});

export const listMediaAction = guards.action({ permission: 'content.manage', input: s.listMedia }, ({ input, ctx }) =>
  content.adminListMedia(input.usage, ctx.user!.id));

export const saveMediaAction = guards.action({ permission: 'content.manage', input: s.saveMedia }, ({ input, ctx }) =>
  content.adminSaveMedia(input, ctx.user!.id));

export const deleteMediaAction = guards.action({ permission: 'content.manage', input: s.mediaRef }, ({ input, ctx }) =>
  content.adminDeleteMedia(input.id, ctx.user!.id));

export const getHomeCmsAction = guards.action({ permission: 'content.manage', input: s.getHomeCms }, ({ ctx }) =>
  content.adminGetHomeCms(ctx.user!.id));

export const saveHomeFeaturedAction = guards.action({ permission: 'content.manage', input: s.saveHomeFeatured }, async ({ input, ctx }) => {
  const config = await content.adminSaveHomeFeatured(input, ctx.user!.id);
  return { config, storefront: await refresh(CMS_TAGS.home) };
});

export const saveHomeJournalAction = guards.action({ permission: 'content.manage', input: s.saveHomeJournal }, async ({ input, ctx }) => {
  const config = await content.adminSaveHomeJournal({ ...input, categorySlug: input.categorySlug ?? null }, ctx.user!.id);
  return { config, storefront: await refresh(CMS_TAGS.home) };
});

export const listDesignsAction = guards.action({ permission: 'content.manage', input: s.listDesigns }, ({ input, ctx }) =>
  content.adminListDesigns(input, ctx.user!.id));

export const saveDesignAction = guards.action({ permission: 'content.manage', input: s.saveDesign }, ({ input, ctx }) =>
  content.adminSaveDesign(input, ctx.user!.id));

export const deleteDesignAction = guards.action({ permission: 'content.manage', input: s.designRef }, ({ input, ctx }) =>
  content.adminDeleteDesign(input.id, ctx.user!.id));
