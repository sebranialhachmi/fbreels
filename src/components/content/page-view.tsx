import Link from 'next/link';
import { AdSlot } from '@/components/ads/ad-slot';
import { CalculatorFor } from '@/components/calculator/calculator-for';
import { FaqList } from '@/components/content/faq-list';
import { ArticlesList, ContactBlock, SitemapList } from '@/components/content/special-pages';
import { Breadcrumbs, type Crumb } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { brand } from '@/config/brand';
import { siteUrl } from '@/config/site';
import { adsOnCalculatorPages } from '@/lib/consent/config';
import { absoluteUrl, allPages, hrefOf, pagesOfKind, type Page } from '@/lib/pages';

function crumbsFor(page: Page): Crumb[] {
  if (page.slug === '') return [];
  const crumbs: Crumb[] = [];
  if (page.kind === 'article') {
    const idx = allPages().find((p) => p.kind === 'articles-index');
    if (idx) crumbs.push({ label: idx.heading, href: hrefOf(idx) });
  }
  crumbs.push({ label: page.heading, href: hrefOf(page) });
  return crumbs;
}

export function PageView({ page }: { page: Page }) {
  const isArticle = page.kind === 'article';
  const related = isArticle ? pagesOfKind('article').filter((a) => a.id !== page.id).slice(0, 2) : [];
  const url = absoluteUrl(hrefOf(page));

  const jsonLd: Record<string, unknown>[] = [];
  if (page.slug === '') {
    jsonLd.push(
      { '@context': 'https://schema.org', '@type': 'WebSite', name: brand.name, url, inLanguage: 'ar' },
      { '@context': 'https://schema.org', '@type': 'WebApplication', name: brand.name, url, description: page.description, applicationCategory: 'FinanceApplication', operatingSystem: 'Any (web browser)', inLanguage: 'ar' },
    );
  } else if (page.hasCalculator) {
    jsonLd.push({ '@context': 'https://schema.org', '@type': 'WebApplication', name: page.heading, url, description: page.description, applicationCategory: 'FinanceApplication', operatingSystem: 'Any (web browser)', inLanguage: 'ar' });
  }
  if (isArticle) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.heading,
      description: page.description,
      inLanguage: 'ar',
      ...(page.published ? { datePublished: page.published } : {}),
      ...(page.reviewed ? { dateModified: page.reviewed } : {}),
      mainEntityOfPage: url,
      image: `${siteUrl}/og.png`,
      publisher: { '@type': 'Organization', name: brand.name, logo: { '@type': 'ImageObject', url: `${siteUrl}/icons/icon-512.png` } },
    });
  }

  return (
    <div className="container-page py-8 sm:py-12">
      {crumbsFor(page).length > 0 && <Breadcrumbs items={crumbsFor(page)} />}
      {jsonLd.length > 0 && <JsonLd data={jsonLd} />}
      <div className={page.hasCalculator ? 'mx-auto mt-6 max-w-[var(--container-tool)]' : 'mx-auto mt-6 max-w-[var(--container-prose)]'}>
        <article>
          <div className="prose-content" dangerouslySetInnerHTML={{ __html: page.before }} />
          {isArticle && (page.published || page.reviewed) && (
            <p className="mt-4 text-sm text-muted">
              {page.published && <>نُشر في {formatDate(page.published)}</>}
              {page.reviewed && <> · آخر مراجعة {formatDate(page.reviewed)}</>}
            </p>
          )}
        </article>
        {page.kind === 'articles-index' && <ArticlesList />}
        {page.kind === 'sitemap' && <SitemapList />}
        {page.id === 'contact' && <ContactBlock />}
        {page.hasCalculator && (
          <div className="my-8">
            <CalculatorFor preset={page.preset} />
          </div>
        )}
        {page.hasCalculator && adsOnCalculatorPages && <AdSlot placement="belowCalculator" className="my-14" />}
        {page.after && <div className="prose-content" dangerouslySetInnerHTML={{ __html: page.after }} />}
        {isArticle && <AdSlot placement="inArticle" className="my-10" />}
        {page.faq.length > 0 && (
          <section aria-labelledby="faq-h" className="mt-12">
            <h2 id="faq-h" className="mb-4 text-2xl font-bold">
              الأسئلة الشائعة
            </h2>
            <FaqList items={page.faq} />
          </section>
        )}
        {related.length > 0 && (
          <aside aria-labelledby="related-h" className="mt-14">
            <h2 id="related-h" className="text-xl font-bold">
              تابع القراءة
            </h2>
            <ul className="mt-4 space-y-2">
              {related.map((a) => (
                <li key={a.id}>
                  <Link href={hrefOf(a)} className="text-primary-text underline">
                    {a.heading}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));
}
