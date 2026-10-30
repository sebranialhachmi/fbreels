import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { MobileNav } from './mobile-nav';
import { headerLinks } from './nav';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  const links = headerLinks();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
      <div className="container-page relative flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded-lg" aria-label="الصفحة الرئيسية">
          <Logo />
        </Link>
        <nav aria-label="التنقل الرئيسي" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-subtle hover:text-fg">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <MobileNav links={links} />
        </div>
      </div>
    </header>
  );
}
