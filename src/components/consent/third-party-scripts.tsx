'use client';

import Script from 'next/script';
import { adsenseEnabled, adsensePublisherId, analyticsDomain, analyticsEnabled, consentMode } from '@/lib/consent/config';
import { useConsent } from './consent-provider';

/** Loads optional third-party scripts only when the matching consent exists. */
export function ThirdPartyScripts() {
  const { consent } = useConsent();
  const loadAds = adsenseEnabled && (consentMode === 'google-cmp' || consent.advertising);
  return (
    <>
      {analyticsEnabled && consent.analytics && <Script src="https://plausible.io/js/script.js" data-domain={analyticsDomain} strategy="afterInteractive" defer />}
      {loadAds && <Script id="adsense-loader" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePublisherId}`} strategy="afterInteractive" crossOrigin="anonymous" />}
    </>
  );
}
