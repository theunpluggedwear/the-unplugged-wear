export const instant = false;
import React from 'react';
import BlogEditor from '@/components/blog/BlogEditor';
import { loadBlogEditorData } from '@/server/blog-editor-data';

export default async function EditJournalPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadBlogEditorData(id);
  return <BlogEditor mode="edit" postId={id} {...data} />;
}
