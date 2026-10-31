import type { MetadataRoute } from 'next';
import { absoluteUrl, allPages, hrefOf } from '@/lib/pages';

export default function sitemap(): MetadataRoute.Sitemap {
  return allPages().map((p) => ({
    url: absoluteUrl(hrefOf(p)),
    // lastmod only when a page was genuinely re-reviewed; the publication date is not a modification date.
    ...(p.reviewed ? { lastModified: p.reviewed } : {}),
  }));
}
