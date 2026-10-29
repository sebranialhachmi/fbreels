import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FaqList, type FaqItem } from '@/components/content/faq-list';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import type { Locale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';

type Props = { params: Promise<{ locale: Locale }> };
const href = { pathname: '/faq' } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.faq' });
  return buildMetadata({ locale, title: t('title'), description: t('description'), href });
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home.faq');
  const nav = await getTranslations('nav');
  const items = (await getTranslations('faq')).raw('items') as FaqItem[];
  // FAQPage structured data is intentionally omitted: Google limits FAQ rich results to a small set of sites.
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[{ label: nav('faq'), href }]} />
      <div className="mx-auto mt-6 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('title')}</h1>
        <div className="mt-8">
          <FaqList items={items} />
        </div>
      </div>
    </div>
  );
}
