'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import {
  adsOnCalculatorPages,
  adsenseEnabled,
  adsensePublisherId,
  analyticsDomain,
  analyticsEnabled,
  consentMode,
} from '@/lib/consent/config';
import { useConsent } from './consent-provider';

/**
 * Loads optional third-party scripts only when the matching consent exists. The advertising script is not loaded
 * on calculator pages (see `adsOnCalculatorPages`). Limitation: if a visitor already loaded it on another page and
 * then navigates client-side to a calculator page, the browser keeps it until the next full page load.
 */
export function ThirdPartyScripts({ calculatorPaths = [] }: { calculatorPaths?: string[] }) {
  const { consent } = useConsent();
  const pathname = usePathname() ?? '/';
  const decoded = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  })();
  const onCalculatorPage = calculatorPaths.includes(decoded);
  const loadAds =
    adsenseEnabled &&
    (consentMode === 'google-cmp' || consent.advertising) &&
    (adsOnCalculatorPages || !onCalculatorPage);
  return (
    <>
      {analyticsEnabled && consent.analytics && (
        <Script
          src="https://plausible.io/js/script.js"
          data-domain={analyticsDomain}
          strategy="afterInteractive"
          defer
        />
      )}
      {loadAds && (
        <Script
          id="adsense-loader"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePublisherId}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      )}
    </>
  );
}
