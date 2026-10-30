import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { absoluteUrl } from '@/lib/pages';
import { JsonLd } from './json-ld';

export type Crumb = { label: string; href: string };

/** Visible breadcrumb trail + matching BreadcrumbList JSON-LD. The last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: 'الرئيسية', href: '/' }, ...items];
  return (
    <>
      <nav aria-label="مسار التنقل" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((c, i) => {
            const last = i === all.length - 1;
            return (
              <li key={c.href} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="font-medium text-fg">
                    {c.label}
                  </span>
                ) : (
                  <Link href={c.href} className="hover:text-fg hover:underline">
                    {c.label}
                  </Link>
                )}
                {!last && <ChevronLeft aria-hidden className="size-4" />}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: absoluteUrl(c.href) })),
        }}
      />
    </>
  );
}
