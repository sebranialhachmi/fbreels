import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/logo';
import { LanguageSelector, type ArticleSlugMap } from './language-selector';
import { MobileNav } from './mobile-nav';
import { HEADER_NAV, ROUTE_FOR } from './nav-items';
import { ThemeToggle } from './theme-toggle';

export async function Header({ articleSlugs }: { articleSlugs: ArticleSlugMap }) {
  const t = await getTranslations('nav');
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
      <div className="container-page relative flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded-lg" aria-label={`${t('home')} — ${t('brandHome')}`}>
          <Logo />
        </Link>
        <nav aria-label={t('main')} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {HEADER_NAV.map((key) => (
              <li key={key}>
                <Link
                  href={ROUTE_FOR[key]}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-subtle hover:text-fg"
                >
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <LanguageSelector articleSlugs={articleSlugs} />
          <ThemeToggle />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
