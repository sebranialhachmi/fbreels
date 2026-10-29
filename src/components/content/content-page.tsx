import { Breadcrumbs, type Crumb } from '@/components/layout/breadcrumbs';

/** Shell for long-form Markdown pages (legal, how-to, about...). */
export function ContentPage({ crumb, html, aside }: { crumb: Crumb; html: string; aside?: React.ReactNode }) {
  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs items={[crumb]} />
      <article className="mx-auto mt-6 max-w-[var(--container-prose)]">
        <div className="prose-content" dangerouslySetInnerHTML={{ __html: html }} />
        {aside}
      </article>
    </div>
  );
}
