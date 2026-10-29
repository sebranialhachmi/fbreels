import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/logo';
import { CookieSettingsButton } from '@/components/consent/cookie-settings-button';
import { FOOTER_COMPANY, FOOTER_LEGAL, FOOTER_PRODUCT, ROUTE_FOR, type NavKey } from './nav-items';

export async function Footer() {
  const t = await getTranslations('footer');
  const n = await getTranslations('nav');

  const column = (title: string, keys: NavKey[], extra?: React.ReactNode) => (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {keys.map((k) => (
          <li key={k}>
            <Link href={ROUTE_FOR[k]} className="hover:text-fg hover:underline">
              {n(k)}
            </Link>
          </li>
        ))}
        {extra}
      </ul>
    </div>
  );

  return (
    <footer className="mt-24 border-t border-border bg-card">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted">{t('tagline')}</p>
          </div>
          {column(t('product'), FOOTER_PRODUCT)}
          {column(t('company'), FOOTER_COMPANY)}
          {column(
            t('legal'),
            FOOTER_LEGAL,
            <li key="cookie-settings">
              <CookieSettingsButton />
            </li>,
          )}
        </div>
        <div className="mt-10 space-y-2 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          <p>{t('independence')}</p>
          <p>{t('responsibility')}</p>
          <p>{t('copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
