import { ChevronRight } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import type { Locale } from '@/i18n/routing';
import { absoluteUrl, type Href } from '@/lib/seo/urls';

export type Crumb = { label: string; href: Href };

/** Visible breadcrumb trail + matching BreadcrumbList JSON-LD. The last crumb is the current page. */
export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = await getTranslations('common');
  const nav = await getTranslations('nav');
  const locale = (await getLocale()) as Locale;
  const all: Crumb[] = [{ label: nav('home'), href: { pathname: '/' } }, ...items];
  return (
    <>
      <nav aria-label={t('breadcrumb')} className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((c, i) => {
            const last = i === all.length - 1;
            return (
              <li key={i} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="font-medium text-fg">
                    {c.label}
                  </span>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <Link href={c.href as any} className="hover:text-fg hover:underline">
                    {c.label}
                  </Link>
                )}
                {!last && <ChevronRight aria-hidden className="size-4 rtl-flip" />}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: all.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.label,
            item: absoluteUrl(locale, c.href),
          })),
        }}
      />
    </>
  );
}
