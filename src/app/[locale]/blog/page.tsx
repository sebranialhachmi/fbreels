import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArticleCard } from '@/components/content/article-card';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getArticles } from '@/lib/content';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/urls';

type Props = { params: Promise<{ locale: Locale }> };
const href = { pathname: '/blog' } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.blog' });
  return buildMetadata({ locale, title: t('title'), description: t('description'), href });
}

export default async function BlogIndex({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('blog');
  const nav = await getTranslations('nav');
  const articles = getArticles(locale);
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[{ label: nav('blog'), href }]} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: t('h1'),
          inLanguage: locale,
          hasPart: articles.map((a) => ({
            '@type': 'Article',
            headline: a.title,
            url: absoluteUrl(locale, { pathname: '/blog/[slug]', params: { slug: a.slug } }),
          })),
        }}
      />
      <header className="mx-auto mt-6 max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('h1')}</h1>
        <p className="mt-3 text-muted">{t('intro')}</p>
      </header>
      <ul className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
        {articles.map((a) => (
          <li key={a.id}>
            <ArticleCard article={a} />
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center text-sm">
        <Link href="/editorial-policy" className="text-primary-text underline">
          {t('editorialNote')}
        </Link>
      </p>
    </div>
  );
}
