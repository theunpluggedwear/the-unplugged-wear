import React from 'react';
import Link from 'next/link';
import { adminGetMobileNav } from '@tuw/heart/modules/content';
import { adminListPosts } from '@tuw/heart/modules/marketing';
import DashboardShell from '@/components/layout/DashboardShell';
import { Badge, PageHeader } from '@/components/ui';
import { BookOpen, Menu, ArrowRight } from 'lucide-react';
import { session } from '@/server/session';

export default async function ContentOverviewPage() {
  const claims = await session.requireStaff('content.manage', '/content');
  const [published, mobile] = await Promise.all([
    adminListPosts({ status: 'published', page: 1, perPage: 1 }, claims.sub),
    adminGetMobileNav(claims.sub),
  ]);
  const sections = [
    {
      title: 'Journal & Stories',
      description: 'Editorial blog posts, lookbook essays and behind-the-scenes narratives.',
      href: '/content/journal',
      icon: <BookOpen size={24} color="#7539FF" />,
      badge: `${published.total} Published`,
    },
    {
      title: 'Store Navigation',
      description: 'Phone and tablet drawer menu. Desktop mega-menu is unchanged.',
      href: '/content/navigation',
      icon: <Menu size={24} color="#856300" />,
      badge: `${mobile.length} Mobile Items`,
    },
  ];

  return (
    <DashboardShell pageTitle="Content Management">
      <PageHeader title="Content & CMS" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        {sections.map((sec) => (
          <Link
            key={sec.title}
            href={sec.href}
            style={{
              textDecoration: 'none',
              backgroundColor: 'var(--tuw-bg-surface, #FFFFFF)',
              border: '1px solid var(--tuw-border-subtle, #E2E4E6)',
              borderRadius: 'var(--tuw-radius-card, 16px)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ padding: 10, borderRadius: 10, backgroundColor: 'var(--tuw-bg-canvas, #F7F8F9)' }}>
                  {sec.icon}
                </div>
                <Badge variant="info">{sec.badge}</Badge>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)', marginBottom: 8 }}>
                {sec.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--tuw-text-secondary, #5D6772)', lineHeight: 1.5 }}>
                {sec.description}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, color: 'var(--tuw-action-primary, #7539FF)', fontWeight: 600, fontSize: 14 }}>
              <span>Manage</span>
              <ArrowRight size={16} />
            </div>
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}
