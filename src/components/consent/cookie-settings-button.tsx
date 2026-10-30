'use client';

import { useConsent } from './consent-provider';

export function CookieSettingsButton({ className }: { className?: string }) {
  const { openPreferences } = useConsent();
  return (
    <button type="button" onClick={openPreferences} className={className ?? 'cursor-pointer text-start hover:text-fg hover:underline'}>
      إعدادات ملفات الارتباط
    </button>
  );
}
