'use client';

import { useTranslations } from 'next-intl';
import { Button, buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/** Error boundary doubling as the "temporarily unavailable" page. Never shows internals. */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');
  return (
    <div className="container-page py-20 text-center" role="alert">
      <h1 className="text-3xl font-extrabold tracking-tight">{t('h1')}</h1>
      <p className="mx-auto mt-3 max-w-xl text-muted">{t('text')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          {t('retry')}
        </Button>
        <Link href="/" className={buttonClasses('outline', 'lg')}>
          {t('home')}
        </Link>
      </div>
    </div>
  );
}
