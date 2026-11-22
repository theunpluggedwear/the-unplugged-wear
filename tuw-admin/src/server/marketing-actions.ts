'use server';

import * as marketing from '@tuw/heart/modules/marketing';
import { marketingSchemas as s, BLOG_TAG } from '@tuw/heart/modules/marketing';
import { CMS_TAGS } from '@tuw/heart/modules/content';
import { guards } from './session';
import { refreshStorefront } from './storefront-cache';

export const listPostsAction = guards.action({ permission: 'content.manage', input: s.listInput }, ({ input, ctx }) =>
  marketing.adminListPosts(input, ctx.user!.id));

export const savePostAction = guards.action({ permission: 'content.manage', input: s.savePost }, async ({ input, ctx }) => {
  const post = await marketing.adminSavePost(input, ctx.user!.id);
  
  const storefront = await refreshStorefront([BLOG_TAG, CMS_TAGS.home]);
  return { post, storefront };
});

export const getPostAction = guards.action({ permission: 'content.manage', input: s.slugRef }, ({ input, ctx }) =>
  marketing.adminGetPost(input.slug, ctx.user!.id));

export const getPostByIdAction = guards.action({ permission: 'content.manage', input: s.postRef }, ({ input, ctx }) =>
  marketing.adminGetPostById(input.id, ctx.user!.id));

export const listRevisionsAction = guards.action({ permission: 'content.manage', input: s.postRef }, ({ input, ctx }) =>
  marketing.adminListRevisions(input.id, ctx.user!.id));

export const restoreRevisionAction = guards.action({ permission: 'content.manage', input: s.revisionRef }, async ({ input, ctx }) => {
  const post = await marketing.adminRestoreRevision(input.postId, input.id, ctx.user!.id);
  const storefront = await refreshStorefront([BLOG_TAG, CMS_TAGS.home]);
  return { post, storefront };
});

export const journalMetaAction = guards.action({ permission: 'content.manage', input: s.listInput.partial() }, ({ ctx }) =>
  marketing.adminJournalMeta(ctx.user!.id));

export const listSubscribersAction = guards.action({ permission: 'content.manage', input: s.newsletterList }, ({ ctx }) =>
  marketing.adminListSubscribers(ctx.user!.id));
