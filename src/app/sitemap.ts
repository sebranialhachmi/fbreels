import type { MetadataRoute } from 'next';
import { absoluteUrl, allPages, hrefOf } from '@/lib/pages';

export default function sitemap(): MetadataRoute.Sitemap {
  return allPages().map((p) => ({
    url: absoluteUrl(hrefOf(p)),
    ...(p.reviewed || p.published ? { lastModified: p.reviewed ?? p.published } : {}),
  }));
}
