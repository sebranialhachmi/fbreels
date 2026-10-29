'use client';

import { useTranslations } from 'next-intl';
import { useConsent } from './consent-provider';

export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations('consent');
  const { openPreferences } = useConsent();
  return (
    <button
      type="button"
      onClick={openPreferences}
      className={className ?? 'cursor-pointer text-start hover:text-fg hover:underline'}
    >
      {t('settings')}
    </button>
  );
}
