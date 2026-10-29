import { getPathname } from '@/i18n/navigation';
import { defaultLocale, locales, type AppPathname, type Locale } from '@/i18n/routing';
import { siteUrl } from '@/config/site';

export type Href =
  | { pathname: Exclude<AppPathname, '/blog/[slug]'> }
  | { pathname: '/blog/[slug]'; params: { slug: string } };

/** Locale-prefixed path (decoded Arabic characters are fine; URL() encodes them for absolute URLs). */
export function localizedPath(locale: Locale, href: Href): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getPathname({ locale, href: href as any });
}

/** Absolute, correctly percent-encoded URL. */
export function absoluteUrl(locale: Locale, href: Href): string {
  const p = localizedPath(locale, href);
  return new URL(p === '/' ? '' : p, `${siteUrl}/`).href.replace(/\/$/, '');
}

export function languageAlternates(hrefFor: (l: Locale) => Href | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of locales) {
    const h = hrefFor(l);
    if (h) out[l] = absoluteUrl(l, h);
  }
  // x-default only if the default-language page genuinely exists
  if (out[defaultLocale]) out['x-default'] = out[defaultLocale]!;
  return out;
}
