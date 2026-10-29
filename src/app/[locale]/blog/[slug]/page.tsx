import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdSlot } from '@/components/ads/ad-slot';
import { ArticleCard } from '@/components/content/article-card';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { buttonClasses } from '@/components/ui/button';
import { brand } from '@/config/brand';
import { Link } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';
import { getArticle, getArticleSlugMap, getArticles } from '@/lib/content';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/urls';

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return locales.flatMap((locale) => getArticles(locale).map((a) => ({ locale, slug: a.slug })));
}

function decode(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getArticle(locale, decode(slug));
  if (!article) return {};
  const slugs = getArticleSlugMap()[article.id] ?? {};
  return buildMetadata({
    locale,
    title: `${article.title} | ${brand.name}`,
    description: article.description,
    href: { pathname: '/blog/[slug]', params: { slug: article.slug } },
    hrefFor: (l) => (slugs[l] ? { pathname: '/blog/[slug]', params: { slug: slugs[l]! } } : null),
    type: 'article',
    publishedTime: article.published,
  });
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  const article = getArticle(locale, decode(slug));
  // Must run before setRequestLocale: the localized 404 renders dynamically for unknown slugs.
  if (!article) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('common');
  const nav = await getTranslations('nav');
  const format = await getFormatter({ locale });
  const related = getArticles(locale)
    .filter((a) => a.id !== article.id)
    .slice(0, 2);
  const href = { pathname: '/blog/[slug]', params: { slug: article.slug } } as const;

  // Split after the second <h2> so one ad can sit inside long-form content, away from the intro.
  const parts = article.html.split(/(?=<h2)/);
  const head = parts.slice(0, 3).join('');
  const tail = parts.slice(3).join('');

  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { label: nav('blog'), href: { pathname: '/blog' } },
          { label: article.title, href },
        ]}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          description: article.description,
          inLanguage: locale,
          datePublished: article.published,
          ...(article.updated ? { dateModified: article.updated } : {}),
          mainEntityOfPage: absoluteUrl(locale, href),
          publisher: { '@type': 'Organization', name: brand.name },
        }}
      />
      <article className="mx-auto mt-6 max-w-[var(--container-prose)]">
        <p className="text-sm text-muted">
          {t('published', {
            date: format.dateTime(new Date(article.published), {
              dateStyle: 'long',
              timeZone: 'UTC',
            }),
          })}{' '}
          · {t('minRead', { minutes: article.readingMinutes })}
          {article.updated &&
            ` · ${t('updated', { date: format.dateTime(new Date(article.updated), { dateStyle: 'long', timeZone: 'UTC' }) })}`}
        </p>
        <div className="prose-content mt-3" dangerouslySetInnerHTML={{ __html: head }} />
        {tail && <AdSlot placement="inArticle" className="my-10" />}
        {tail && <div className="prose-content mt-6" dangerouslySetInnerHTML={{ __html: tail }} />}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className={buttonClasses('primary')}>
            {t('tryTool')}
          </Link>
          <Link href="/blog" className={buttonClasses('outline')}>
            {t('backToBlog')}
          </Link>
        </div>
      </article>
      {related.length > 0 && (
        <aside className="mx-auto mt-14 max-w-4xl" aria-labelledby="related-h">
          <h2 id="related-h" className="text-xl font-bold">
            {t('related')}
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {related.map((a) => (
              <li key={a.id}>
                <ArticleCard article={a} />
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
