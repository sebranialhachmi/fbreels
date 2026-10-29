import { getTranslations } from 'next-intl/server';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  const nav = await getTranslations('nav');
  const meta = await getTranslations('meta.notFound');
  return (
    <div className="container-page py-20 text-center">
      {/* Next adds noindex to 404s. The localized title is rendered here (hoisted to <head> by React 19) so no request-time metadata lookup is needed. */}
      <title>{meta('title')}</title>
      <p className="text-6xl font-extrabold text-gradient" aria-hidden>
        404
      </p>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{t('h1')}</h1>
      <p className="mx-auto mt-3 max-w-xl text-muted">{t('text')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClasses('primary', 'lg')}>
          {nav('home')}
        </Link>
        <Link href="/facebook-reels-downloader" className={buttonClasses('outline', 'lg')}>
          {nav('tool')}
        </Link>
      </div>
      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wider text-muted">
        {t('suggested')}
      </h2>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
        {(['howTo', 'blog', 'faq', 'contact'] as const).map((k) => (
          <li key={k}>
            <Link
              href={
                { howTo: '/how-to-download', blog: '/blog', faq: '/faq', contact: '/contact' }[
                  k
                ] as '/'
              }
              className="text-primary-text underline"
            >
              {nav(k)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
