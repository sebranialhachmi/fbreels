import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdSlot } from '@/components/ads/ad-slot';
import { Downloader } from '@/components/downloader/downloader';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { brand } from '@/config/brand';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/urls';

type Props = { params: Promise<{ locale: Locale }> };
const href = { pathname: '/facebook-reels-downloader' } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.tool' });
  return buildMetadata({ locale, title: t('title'), description: t('description'), href });
}

export default async function ToolPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('reels');
  const nav = await getTranslations('nav');
  const meta = await getTranslations('meta.tool');
  const patterns = t.raw('patterns') as { label: string; example: string }[];
  const copySteps = t.raw('copySteps') as string[];
  const limits = t.raw('limits') as string[];

  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[{ label: nav('tool'), href }]} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: `${brand.name} — ${t('h1')}`,
          url: absoluteUrl(locale, href),
          description: meta('description'),
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Any (web browser)',
          inLanguage: locale,
        }}
      />
      <header className="mx-auto mt-6 max-w-3xl text-center">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t('h1')}
        </h1>
        <p className="mt-3 text-muted">{t('intro')}</p>
      </header>
      <div className="mx-auto mt-8 max-w-[var(--container-tool)]">
        <Downloader />
      </div>

      <AdSlot placement="belowTool" className="mt-16" />

      <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-bold">{t('linksTitle')}</h2>
          <p className="mt-2 text-sm text-muted">{t('linksIntro')}</p>
          <dl className="mt-4 space-y-3">
            {patterns.map((p) => (
              <div key={p.label}>
                <dt className="text-sm font-semibold">{p.label}</dt>
                <dd>
                  <code
                    dir="ltr"
                    className="isolate-text mt-1 inline-block rounded-md border border-border bg-subtle px-2 py-1 text-sm"
                  >
                    {p.example}
                  </code>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-bold">{t('copyTitle')}</h2>
          <ol className="mt-4 list-decimal space-y-2 ps-5 text-muted">
            {copySteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>
        <Card className="p-6 md:col-span-2">
          <h2 className="text-xl font-bold">{t('limitsTitle')}</h2>
          <ul className="mt-4 list-disc space-y-2 ps-5 text-muted">
            {limits.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">{t('moreTitle')}:</span>
            <Link href="/how-to-download" className={buttonClasses('outline', 'sm')}>
              {t('moreLinks.howTo')}
            </Link>
            <Link href="/faq" className={buttonClasses('outline', 'sm')}>
              {t('moreLinks.faq')}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
