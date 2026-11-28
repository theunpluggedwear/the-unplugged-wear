import React from 'react';
import Link from 'next/link';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

interface SeeAllLinkProps {
  href: string;
  children?: React.ReactNode;
}

export function SeeAllLink({ href, children = 'See all' }: SeeAllLinkProps) {
  return (
    <Link href={href} className={styles.seeAllBtn} style={{ textDecoration: 'none' }}>
      {children}
    </Link>
  );
}
