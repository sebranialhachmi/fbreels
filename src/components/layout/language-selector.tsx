'use client';

import { Check, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { localeNames, locales, type AppPathname, type Locale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics/track';

export type ArticleSlugMap = Record<string, Partial<Record<Locale, string>>>;

/**
 * Real links (not JS navigation) so every language remains reachable without scripting
 * and crawlers can follow them. Blog articles map to the sibling article's localized slug.
 */
export function LanguageSelector({ articleSlugs }: { articleSlugs: ArticleSlugMap }) {
  const t = useTranslations('language');
  const current = useLocale() as Locale;
  const pathname = usePathname() as AppPathname;
  const params = useParams<{ slug?: string }>();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector('button')?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  function hrefFor(locale: Locale) {
    if (pathname === '/blog/[slug]') {
      const slug = decodeURIComponent(String(params.slug ?? ''));
      const entry = Object.values(articleSlugs).find((m) => m[current] === slug);
      const target = entry?.[locale];
      if (target) return { pathname: '/blog/[slug]' as const, params: { slug: target } };
      return { pathname: '/blog' as const };
    }
    return { pathname } as { pathname: Exclude<AppPathname, '/blog/[slug]'> };
  }

  return (
    <div ref={root} className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="language-menu"
        // Accessible name starts with the visible text (WCAG 2.5.3 Label in Name).
        aria-label={`${current.toUpperCase()} – ${localeNames[current]} (${t('label')})`}
        onClick={() => setOpen((o) => !o)}
        className="gap-1.5"
      >
        <Languages aria-hidden className="size-5" />
        <span className="uppercase" aria-hidden>
          {current}
        </span>
      </Button>
      {open && (
        <ul
          id="language-menu"
          className="absolute end-0 z-50 mt-2 w-44 rounded-card border border-border bg-card p-1.5 shadow-pop"
        >
          {locales.map((l) => (
            <li key={l}>
              <Link
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                href={hrefFor(l) as any}
                locale={l}
                hrefLang={l}
                lang={l}
                aria-current={l === current ? 'true' : undefined}
                onClick={() => {
                  track('language_selected', { locale: l });
                  setOpen(false);
                }}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-subtle aria-[current=true]:font-semibold"
              >
                {localeNames[l]}
                {l === current && <Check aria-hidden className="size-4 text-primary-text" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
