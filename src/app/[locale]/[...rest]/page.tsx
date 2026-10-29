import { notFound } from 'next/navigation';

/** Any unmatched URL under a valid locale renders the localized 404 page. */
export default function CatchAll() {
  notFound();
}
