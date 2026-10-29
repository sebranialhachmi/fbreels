import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';
const adsense = /^ca-pub-\d{10,20}$/.test(process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID ?? '');
const plausible = !!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
// HTTPS-only hardening is applied only when the site is configured as https, so a plain-HTTP staging
// deployment (e.g. a container without TLS) is not broken by upgrade-insecure-requests.
const httpsSite = isProd && (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://');

/**
 * Content-Security-Policy is built from the actual configuration: ad and analytics hosts are
 * only allowed when those integrations are enabled. 'unsafe-inline' for scripts is required by
 * Next.js inline bootstrap and the theme script; a per-request nonce would force every page to
 * render dynamically (documented trade-off in README).
 */
function buildCsp() {
  const adScript = adsense
    ? ' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.adtrafficquality.google'
    : '';
  const analyticsHost = plausible ? ' https://plausible.io' : '';
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}${adScript}${analyticsHost}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'${adsense ? ' https://*.google.com https://*.doubleclick.net https://*.googlesyndication.com https://*.adtrafficquality.google' : ''}${analyticsHost}`,
    `frame-src ${adsense ? 'https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.google.com https://*.doubleclick.net' : "'none'"}`,
    `media-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(httpsSite ? ['upgrade-insecure-requests'] : []),
  ];
  return directives.join('; ');
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: buildCsp() },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), clipboard-read=(self), clipboard-write=(self)',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(httpsSite
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  // Allows e2e runs to use separate build directories without clobbering a local build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  // Markdown content is read from disk at runtime; make sure the standalone bundle ships it.
  outputFileTracingIncludes: { '/**/*': ['./content/**/*'] },
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      {
        source: '/fonts/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/icons/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
