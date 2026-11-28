// Shared navigation model for the mega-menu and mobile drawer. Filters point at
// shop listings for live product counts; image tiles resolve by product slug.
// The six menus live in navigation-menu.json so the fallback and the seeded
// navigation_settings.navbar.menu cannot drift apart.

import menuData from './navigation-menu.json' with { type: 'json' };
import type { ShopFilter } from '../../lib/product';

export interface NavLink {
  label: string;
  href: string;
  /** Shop filter behind this link; used for the product count. */
  filter?: ShopFilter;
}

export interface NavColumn {
  title: string;
  links: NavLink[];
}

export interface NavFeature {
  /** Catalog product supplying the image (and default title, price and link). */
  productSlug?: string;
  /** Fixed image for non-product tiles (e.g. editorial). */
  image?: string;
  /** CSS object-position for the 4:5 tile crop. */
  imagePosition?: string;
  title?: string;
  caption?: string;
  href?: string;
}

export interface NavItem {
  label: string;
  href: string;
  columns?: NavColumn[];
  features?: NavFeature[];
  /** "Shop all …" link shown at the foot of the panel. */
  shopAll?: NavLink;
}

export const NAV_ITEMS: NavItem[] = menuData as NavItem[];
