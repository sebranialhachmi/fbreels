import Link from 'next/link';
import { ContactForm } from '@/components/forms/contact-form';
import { publicContactEmail } from '@/config/site';
import { hrefOf, pagesOfKind, type PageKind } from '@/lib/pages';

export function ArticlesList() {
  const articles = pagesOfKind('article');
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {articles.map((a) => (
        <li key={a.id} className="relative rounded-card border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-pop">
          <h2 className="text-lg font-bold leading-snug">
            <Link href={hrefOf(a)} className="after:absolute after:inset-0 hover:underline">
              {a.heading}
            </Link>
          </h2>
          <p className="mt-2 text-sm text-muted">{a.description}</p>
        </li>
      ))}
    </ul>
  );
}

const GROUPS: { title: string; kinds: PageKind[] }[] = [
  { title: 'الحاسبات', kinds: ['calculator'] },
  { title: 'القطاعات الأخرى', kinds: ['sector'] },
  { title: 'المقالات', kinds: ['article', 'articles-index'] },
  { title: 'الموقع والسياسات', kinds: ['static', 'legal', 'sitemap'] },
];

export function SitemapList() {
  return (
    <div className="mt-6 grid gap-8 sm:grid-cols-2">
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="text-lg font-bold">{g.title}</h2>
          <ul className="mt-3 space-y-2">
            {pagesOfKind(...g.kinds).map((p) => (
              <li key={p.id}>
                <Link href={hrefOf(p)} className="text-primary-text underline">
                  {p.heading}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ContactBlock() {
  return (
    <div className="mt-8">
      <div className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
        <ContactForm />
      </div>
      {publicContactEmail && (
        <p className="mt-6 text-sm text-muted">
          يمكنك أيضاً مراسلتنا على{' '}
          <a href={`mailto:${publicContactEmail}`} dir="ltr" className="isolate-text text-primary-text underline">
            {publicContactEmail}
          </a>
        </p>
      )}
    </div>
  );
}
