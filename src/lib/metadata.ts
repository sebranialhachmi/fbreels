import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { siteUrl } from '@/config/site';
import { absoluteUrl, type PageMeta, hrefOf } from './pages';

export function buildMetadata(page: Pick<PageMeta, 'title' | 'description' | 'slug'>, type: 'website' | 'article' = 'website', published?: string): Metadata {
  const url = absoluteUrl(hrefOf(page));
  const image = { url: `${siteUrl}/og.png`, width: 1200, height: 630, alt: brand.name };
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type,
      url,
      title: page.title,
      description: page.description,
      siteName: brand.name,
      locale: 'ar_SA',
      images: [image],
      ...(type === 'article' && published ? { publishedTime: published } : {}),
    },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description, images: [image.url] },
  };
}
