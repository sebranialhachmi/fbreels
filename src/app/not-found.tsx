import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';
import { hrefOf, pageById } from '@/lib/pages';

export const metadata = { title: 'الصفحة غير موجودة', robots: { index: false, follow: false } };

export default function NotFound() {
  const suggestions = ['resignation', 'termination', 'government', 'articles', 'contact'].map(
    (id) => pageById(id),
  );
  return (
    <div className="container-page py-20 text-center">
      <p className="text-6xl font-extrabold text-gradient" aria-hidden>
        404
      </p>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">الصفحة غير موجودة</h1>
      <p className="mx-auto mt-3 max-w-xl text-muted">
        الصفحة التي تبحث عنها غير موجودة أو نُقلت. إليك بعض الأماكن للمتابعة.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClasses('primary', 'lg')}>
          الرئيسية
        </Link>
      </div>
      <h2 className="mt-12 text-sm font-semibold text-muted">صفحات مقترحة</h2>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
        {suggestions.map((p) => (
          <li key={p.id}>
            <Link href={hrefOf(p)} className="text-primary-text underline">
              {p.heading}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
