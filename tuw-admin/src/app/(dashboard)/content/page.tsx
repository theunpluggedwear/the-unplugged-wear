export const instant = false;
import React from 'react';
import Link from 'next/link';
import { adminGetMenu } from '@tuw/heart/modules/content';
import { adminListPosts } from '@tuw/heart/modules/marketing';
import { Badge, ContentCard, PageHeader } from '@/components/ui';
import { BookOpen, Menu, ArrowRight } from 'lucide-react';
import { session } from '@/server/session';

export default async function ContentOverviewPage() {
  const claims = await session.requireStaff('content.manage', '/content');
  const [published, menu] = await Promise.all([
    adminListPosts({ status: 'published', page: 1, perPage: 1 }, claims.sub),
    adminGetMenu(claims.sub),
  ]);
  const sections = [
    {
      title: 'Journal & Stories',
      description: 'Editorial blog posts, lookbook essays and behind-the-scenes narratives.',
      href: '/content/journal',
      icon: <BookOpen size={24} color="var(--tuw-action-primary)" />,
      badge: `${published.total} Published`,
    },
    {
      title: 'Store Navigation',
      description: 'One menu for the phone drawer and the desktop header.',
      href: '/content/navigation',
      icon: <Menu size={24} color="var(--tuw-action-primary)" />,
      badge: `${menu.length} Menu Items`,
    },
  ];

  return (
    <>
      <PageHeader title="Content & CMS" />

      <div className="grid gap-5 md:grid-cols-2">
        {sections.map((sec) => (
          <Link key={sec.title} href={sec.href} style={{ textDecoration: 'none' }}>
            <ContentCard>
              <div className="flex items-start justify-between gap-4">
                <div style={{ padding: 10, borderRadius: 10, background: 'var(--tuw-bg-canvas)' }}>
                  {sec.icon}
                </div>
                <Badge variant="info">{sec.badge}</Badge>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>
                {sec.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--tuw-text-secondary)' }}>
                {sec.description}
              </p>
              <div className="flex items-center gap-2" style={{ color: 'var(--tuw-action-primary)', fontWeight: 600, fontSize: 14 }}>
                <span>Manage</span>
                <ArrowRight size={16} />
              </div>
            </ContentCard>
          </Link>
        ))}
      </div>
    </>
  );
}
