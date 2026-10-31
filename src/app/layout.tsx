import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { ConsentBanner, PreferencesDialog } from '@/components/consent/consent-ui';
import { ConsentProvider } from '@/components/consent/consent-provider';
import { ThirdPartyScripts } from '@/components/consent/third-party-scripts';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { ThemeScript } from '@/components/layout/theme-script';
import { brand } from '@/config/brand';
import { siteUrl } from '@/config/site';
import { hrefOf, pageById, pagesOfKind } from '@/lib/pages';

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
  title: brand.name,
  applicationName: brand.name,
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <ThemeScript />
        {/* Preloaded together with font-display: optional so the web font cannot cause layout shift. */}
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
      </head>
      <body className="flex min-h-dvh flex-col">
        <ConsentProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
          >
            الانتقال إلى المحتوى الرئيسي
          </a>
          <Header />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <Footer />
          <ConsentBanner policyHref={hrefOf(pageById('cookies'))} />
          <PreferencesDialog policyHref={hrefOf(pageById('cookies'))} />
          <ThirdPartyScripts calculatorPaths={pagesOfKind('calculator').map(hrefOf)} />
        </ConsentProvider>
      </body>
    </html>
  );
}
