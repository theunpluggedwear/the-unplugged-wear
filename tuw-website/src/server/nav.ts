import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { getStorefrontNavigation, PRODUCTS_TAG, type StorefrontCategory } from '@tuw/heart/modules/catalog';
import { CMS_TAGS, getStorefrontMenu } from '@tuw/heart/modules/content';
import { NAV_ITEMS, type NavItem } from '@storefront/components/layout/navigation';
import { navItemsFromCms } from '@storefront/lib/nav-from-cms';

export const NAV_TAG = 'nav';

export interface Navigation {
  categories: StorefrontCategory[];
  hiddenCategories: string[];
  navbarCategories: string[];
  menuItems: NavItem[];
}

export async function getNavigation(): Promise<Navigation> {
  'use cache';
  cacheTag(NAV_TAG, PRODUCTS_TAG, CMS_TAGS.nav);
  cacheLife('hours');
  const [categories, menu] = await Promise.all([getStorefrontNavigation(), getStorefrontMenu()]);
  return {
    categories,
    hiddenCategories: categories.filter((c) => !c.showInMegamenu).map((c) => c.slug),
    navbarCategories: categories.filter((c) => c.showInNavbar && c.showInMegamenu).map((c) => c.slug),
    menuItems: menu.length ? navItemsFromCms(menu) : NAV_ITEMS,
  };
}
