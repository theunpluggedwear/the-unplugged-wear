'use server';

import * as marketing from '@tuw/heart/modules/marketing';
import { marketingSchemas as s } from '@tuw/heart/modules/marketing';
import { guards } from './session';

export const listPostsAction = guards.action({ permission: 'content.manage', input: s.listInput }, ({ input, ctx }) =>
  marketing.adminListPosts(input, ctx.user!.id));

export const savePostAction = guards.action({ permission: 'content.manage', input: s.savePost }, ({ input, ctx }) =>
  marketing.adminSavePost(input, ctx.user!.id));

export const getPostAction = guards.action({ permission: 'content.manage', input: s.slugRef }, ({ input, ctx }) =>
  marketing.adminGetPost(input.slug, ctx.user!.id));

export const journalMetaAction = guards.action({ permission: 'content.manage', input: s.listInput.partial() }, ({ ctx }) =>
  marketing.adminJournalMeta(ctx.user!.id));

export const listSubscribersAction = guards.action({ permission: 'content.manage', input: s.newsletterList }, ({ ctx }) =>
  marketing.adminListSubscribers(ctx.user!.id));
