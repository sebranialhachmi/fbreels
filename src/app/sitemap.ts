import type { MetadataRoute } from 'next';
import { locales, pathnames, type Locale } from '@/i18n/routing';
import { getArticleSlugMap, getArticles } from '@/lib/content';
import { absoluteUrl, languageAlternates, type Href } from '@/lib/seo/urls';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  const staticRoutes = (Object.keys(pathnames) as (keyof typeof pathnames)[]).filter(
    (p) => p !== '/blog/[slug]',
  ) as Exclude<keyof typeof pathnames, '/blog/[slug]'>[];
  for (const pathname of staticRoutes) {
    const hrefFor = (): Href => ({ pathname });
    for (const l of locales) {
      entries.push({
        url: absoluteUrl(l, hrefFor()),
        alternates: { languages: languageAlternates(hrefFor) },
      });
    }
  }

  const slugMap = getArticleSlugMap();
  for (const l of locales) {
    for (const a of getArticles(l as Locale)) {
      const slugs = slugMap[a.id] ?? {};
      entries.push({
        url: absoluteUrl(l, { pathname: '/blog/[slug]', params: { slug: a.slug } }),
        lastModified: a.updated ?? a.published,
        alternates: {
          languages: languageAlternates((x) =>
            slugs[x] ? { pathname: '/blog/[slug]', params: { slug: slugs[x]! } } : null,
          ),
        },
      });
    }
  }
  return entries;
}
