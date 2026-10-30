import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageView } from '@/components/content/page-view';
import { buildMetadata } from '@/lib/metadata';
import { allPages, getPage } from '@/lib/pages';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allPages()
    .filter((p) => p.slug !== '')
    .map((p) => ({ slug: p.slug }));
}

function decode(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getPage(decode((await params).slug));
  return page
    ? buildMetadata(page, page.kind === 'article' ? 'article' : 'website', page.published)
    : {};
}

export default async function ContentPage({ params }: Props) {
  const page = getPage(decode((await params).slug));
  if (!page || page.slug === '') notFound();
  return <PageView page={page} />;
}
