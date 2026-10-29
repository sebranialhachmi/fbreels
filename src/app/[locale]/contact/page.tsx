import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactForm } from '@/components/forms/contact-form';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { publicContactEmail } from '@/config/site';
import type { Locale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';

type Props = { params: Promise<{ locale: Locale }> };
const href = { pathname: '/contact' } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.contact' });
  return buildMetadata({ locale, title: t('title'), description: t('description'), href });
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
  const nav = await getTranslations('nav');
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[{ label: nav('contact'), href }]} />
      <div className="mx-auto mt-6 max-w-xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('h1')}</h1>
        <p className="mt-3 text-muted">{t('intro')}</p>
        <div className="mt-8 rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
          <ContactForm />
        </div>
        {publicContactEmail && (
          <p className="mt-6 text-sm text-muted">
            {t('directEmail')}{' '}
            <a
              href={`mailto:${publicContactEmail}`}
              dir="ltr"
              className="isolate-text text-primary-text underline"
            >
              {publicContactEmail}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
