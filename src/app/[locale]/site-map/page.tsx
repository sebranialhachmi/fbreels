import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { FOOTER_LEGAL, ROUTE_FOR, type NavKey } from '@/components/layout/nav-items';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getArticles } from '@/lib/content';
import { buildMetadata } from '@/lib/seo/metadata';

type Props = { params: Promise<{ locale: Locale }> };
const href = { pathname: '/site-map' } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.sitemap' });
  return buildMetadata({ locale, title: t('title'), description: t('description'), href });
}

export default async function SitemapPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sitemapPage');
  const nav = await getTranslations('nav');
  const articles = getArticles(locale);

  const groups: { title: string; keys: NavKey[] }[] = [
    { title: t('tool'), keys: ['home', 'tool', 'howTo', 'faq'] },
    { title: t('company'), keys: ['about', 'contact', 'editorial'] },
    { title: t('legal'), keys: FOOTER_LEGAL },
  ];
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[{ label: nav('sitemap'), href }]} />
      <div className="mx-auto mt-6 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('h1')}</h1>
        <p className="mt-3 text-muted">{t('intro')}</p>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="text-lg font-bold">{g.title}</h2>
              <ul className="mt-3 space-y-2">
                {g.keys.map((k) => (
                  <li key={k}>
                    <Link href={ROUTE_FOR[k]} className="text-primary-text underline">
                      {nav(k)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section>
            <h2 className="text-lg font-bold">
              <Link href="/blog" className="hover:underline">
                {t('articles')}
              </Link>
            </h2>
            <ul className="mt-3 space-y-2">
              {articles.map((a) => (
                <li key={a.id}>
                  <Link
                    href={{ pathname: '/blog/[slug]', params: { slug: a.slug } }}
                    className="text-primary-text underline"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
