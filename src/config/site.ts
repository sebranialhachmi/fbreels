const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000';

/** Canonical origin without trailing slash. Set NEXT_PUBLIC_SITE_URL in production. */
export const siteUrl = raw.replace(/\/+$/, '');

export const isProduction = process.env.NODE_ENV === 'production';

/** Optional public contact address shown on legal pages. Never fabricated. */
export const publicContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || '';
