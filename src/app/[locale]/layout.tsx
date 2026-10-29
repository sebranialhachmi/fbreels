import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@/styles/globals.css';
import { ConsentBanner, PreferencesDialog } from '@/components/consent/consent-ui';
import { ConsentProvider } from '@/components/consent/consent-provider';
import { ThirdPartyScripts } from '@/components/consent/third-party-scripts';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { ThemeScript } from '@/components/layout/theme-script';
import { brand } from '@/config/brand';
import { siteUrl } from '@/config/site';
import { getDirection, isLocale, locales } from '@/i18n/routing';
import { getArticleSlugMap } from '@/lib/content';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: brand.themeColor },
    { media: '(prefers-color-scheme: dark)', color: '#0b1020' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: brand.name, // fallback only; every page sets its own localized title
  applicationName: brand.name,
  formatDetection: { telephone: false },
};

const CLIENT_NAMESPACES = [
  'downloader',
  'theme',
  'nav',
  'language',
  'consent',
  'ads',
  'contact',
  'error',
] as const;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const [messages, t] = await Promise.all([
    getMessages(),
    getTranslations({ locale, namespace: 'common' }),
  ]);
  const clientMessages = Object.fromEntries(
    CLIENT_NAMESPACES.map((ns) => [ns, (messages as Record<string, unknown>)[ns]]),
  );

  return (
    <html lang={locale} dir={getDirection(locale)} suppressHydrationWarning>
      <head>
        <ThemeScript />
        {locale === 'ar' && (
          <>
            {/* Preloaded only for Arabic, together with font-display: optional, so the web font cannot cause layout shift. */}
            <link
              rel="preload"
              href="/fonts/cairo-arabic-wght-normal.woff2"
              as="font"
              type="font/woff2"
              crossOrigin="anonymous"
            />
            <link
              rel="preload"
              href="/fonts/cairo-latin-wght-normal.woff2"
              as="font"
              type="font/woff2"
              crossOrigin="anonymous"
            />
          </>
        )}
      </head>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider locale={locale} messages={clientMessages}>
          <ConsentProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
            >
              {t('skipToContent')}
            </a>
            <Header articleSlugs={getArticleSlugMap()} />
            <main id="main" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <Footer />
            <ConsentBanner />
            <PreferencesDialog />
            <ThirdPartyScripts />
          </ConsentProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
