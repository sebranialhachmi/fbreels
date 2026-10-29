import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { siteUrl } from '@/config/site';
import type { Locale } from '@/i18n/routing';
import { absoluteUrl, languageAlternates, type Href } from './urls';

const OG_LOCALE: Record<Locale, string> = { en: 'en_US', fr: 'fr_FR', es: 'es_ES', ar: 'ar_AR' };

type Input = {
  locale: Locale;
  title: string;
  description: string;
  /** This page's href in `locale`. */
  href: Href;
  /** Equivalent page per language; return null where no genuine equivalent exists. */
  hrefFor?: (l: Locale) => Href | null;
  type?: 'website' | 'article';
  publishedTime?: string;
  noindex?: boolean;
};

export function buildMetadata({
  locale,
  title,
  description,
  href,
  hrefFor,
  type = 'website',
  publishedTime,
  noindex,
}: Input): Metadata {
  const url = absoluteUrl(locale, href);
  const image = { url: `${siteUrl}/og.png`, width: 1200, height: 630, alt: brand.name };
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(hrefFor ?? (() => href)),
    },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: brand.name,
      locale: OG_LOCALE[locale],
      alternateLocale: Object.values(OG_LOCALE).filter((l) => l !== OG_LOCALE[locale]),
      images: [image],
      ...(type === 'article' && publishedTime ? { publishedTime } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}
