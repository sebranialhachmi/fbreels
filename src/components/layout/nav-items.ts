import type { AppPathname } from '@/i18n/routing';

export type NavKey =
  | 'home'
  | 'tool'
  | 'howTo'
  | 'blog'
  | 'faq'
  | 'about'
  | 'contact'
  | 'editorial'
  | 'privacy'
  | 'terms'
  | 'copyright'
  | 'disclaimer'
  | 'cookies'
  | 'accessibility'
  | 'sitemap';

export const ROUTE_FOR: Record<NavKey, Exclude<AppPathname, '/blog/[slug]'>> = {
  home: '/',
  tool: '/facebook-reels-downloader',
  howTo: '/how-to-download',
  blog: '/blog',
  faq: '/faq',
  about: '/about',
  contact: '/contact',
  editorial: '/editorial-policy',
  privacy: '/privacy-policy',
  terms: '/terms',
  copyright: '/copyright',
  disclaimer: '/disclaimer',
  cookies: '/cookie-policy',
  accessibility: '/accessibility',
  sitemap: '/site-map',
};

export const HEADER_NAV: NavKey[] = ['home', 'howTo', 'blog', 'faq', 'about'];
export const FOOTER_PRODUCT: NavKey[] = ['home', 'tool', 'howTo', 'blog', 'faq'];
export const FOOTER_COMPANY: NavKey[] = ['about', 'contact', 'editorial', 'sitemap'];
export const FOOTER_LEGAL: NavKey[] = [
  'privacy',
  'terms',
  'copyright',
  'disclaimer',
  'cookies',
  'accessibility',
];
