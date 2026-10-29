import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPage } from '@/components/content/content-page';
import type { NavKey } from '@/components/layout/nav-items';
import type { AppPathname, Locale } from '@/i18n/routing';
import { getPage, type PageName } from '@/lib/content';
import { buildMetadata } from '@/lib/seo/metadata';

type Props = { params: Promise<{ locale: Locale }> };

/** Builds the metadata + page component for a Markdown-backed static page. */
export function makeContentPage(name: PageName, navKey: NavKey, href: { pathname: Exclude<AppPathname, '/blog/[slug]'> }) {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const page = getPage(locale, name);
    return buildMetadata({ locale, title: page.title, description: page.description, href });
  }

  async function Page({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const page = getPage(locale, name);
    const nav = await getTranslations({ locale, namespace: 'nav' });
    return <ContentPage crumb={{ label: nav(navKey), href }} html={page.html} />;
  }

  return { generateMetadata, Page };
}
