import React from 'react';
import BlogEditor from '@/components/blog/BlogEditor';
import { loadBlogEditorData } from '@/server/blog-editor-data';

export default async function NewJournalPostPage() {
  const data = await loadBlogEditorData();
  return <BlogEditor mode="create" {...data} />;
}
