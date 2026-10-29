'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { HEADER_NAV, ROUTE_FOR } from './nav-items';

export function MobileNav() {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <Button
        ref={button}
        variant="ghost"
        size="icon"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? t('closeMenu') : t('openMenu')}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
      </Button>
      {open && (
        <nav
          id="mobile-nav-panel"
          aria-label={t('mobile')}
          className="absolute inset-x-0 top-full border-b border-border bg-card px-4 pb-4 pt-2 shadow-pop"
        >
          <ul className="space-y-1">
            {HEADER_NAV.map((key) => (
              <li key={key}>
                <Link
                  href={ROUTE_FOR[key]}
                  className="block rounded-lg px-3 py-3 text-base font-medium hover:bg-subtle"
                  aria-current={pathname === ROUTE_FOR[key] ? 'page' : undefined}
                >
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
