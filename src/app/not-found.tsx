import Link from 'next/link';

/** Fallback for requests that cannot be mapped to a locale at all. Locale-aware 404s live under [locale]. */
export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1rem' }}
      >
        <h1>404 — Page not found</h1>
        <p>
          <Link href="/en">English</Link> · <Link href="/fr">Français</Link> ·{' '}
          <Link href="/es">Español</Link> · <Link href="/ar">العربية</Link>
        </p>
      </body>
    </html>
  );
}
