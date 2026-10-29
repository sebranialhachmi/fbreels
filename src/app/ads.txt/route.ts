import { ADSENSE_PUBLISHER_RE } from '@/lib/consent/config';

export const dynamic = 'force-static';

/**
 * Serves ads.txt ONLY when a syntactically valid AdSense publisher id is configured.
 * Without one it returns 404, so an invalid or placeholder file is never published.
 * (Google's certification authority id f08c47fec0942fa0 is the documented AdSense value.)
 */
export function GET() {
  const id = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID?.trim() ?? '';
  if (!ADSENSE_PUBLISHER_RE.test(id)) return new Response('Not found', { status: 404 });
  const body = `google.com, ${id.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
