import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageView } from '@/components/content/page-view';
import { buildMetadata } from '@/lib/metadata';
import { getPage } from '@/lib/pages';

export function generateMetadata(): Metadata {
  const page = getPage('');
  return page ? buildMetadata(page) : {};
}

export default function HomePage() {
  const page = getPage('');
  if (!page) notFound();
  return <PageView page={page} />;
}
