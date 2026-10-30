'use client';

import Link from 'next/link';
import { Button, buttonClasses } from '@/components/ui/button';

/** Error boundary doubling as the "temporarily unavailable" page. Never shows internals. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page py-20 text-center" role="alert">
      <h1 className="text-3xl font-extrabold tracking-tight">الخدمة غير متاحة مؤقتاً</h1>
      <p className="mx-auto mt-3 max-w-xl text-muted">حدث خلل أثناء تحميل هذه الصفحة. غالباً ما يكون مؤقتاً. يرجى المحاولة مرة أخرى بعد قليل.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          إعادة المحاولة
        </Button>
        <Link href="/" className={buttonClasses('outline', 'lg')}>
          الذهاب إلى الرئيسية
        </Link>
      </div>
    </div>
  );
}
