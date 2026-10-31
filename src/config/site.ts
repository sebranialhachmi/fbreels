const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000';

/** Canonical origin without trailing slash. Set NEXT_PUBLIC_SITE_URL in production. */
export const siteUrl = raw.replace(/\/+$/, '');

export const isProduction = process.env.NODE_ENV === 'production';

/** Optional public contact address shown on the contact page. Never fabricated. */
export const publicContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || '';

/** Google Search Console ownership verification (meta tag method). Public by design. */
export const googleSiteVerification =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ||
  '1W5TAEYrXGw8cNvr9z7xaojiuf_VwVPRJGcMVD529WY';

/**
 * AdSense account meta tag (links the site to the account for review). Public by design. This tag alone does NOT
 * load ads: ads are controlled separately by NEXT_PUBLIC_ADSENSE_PUBLISHER_ID and visitor consent.
 */
export const adsenseAccountMeta =
  process.env.NEXT_PUBLIC_ADSENSE_ACCOUNT_META?.trim() || 'ca-pub-7862862797963182';
