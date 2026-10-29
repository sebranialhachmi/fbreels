'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  analyticsEnabled,
  advertisingNeedsBuiltinConsent,
  hasOptionalTracking,
} from '@/lib/consent/config';
import { useConsent } from './consent-provider';

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-control border border-border p-4">
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <p id={`${id}-desc`} className="mt-1 text-sm text-muted">
          {description}
        </p>
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-describedby={`${id}-desc`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
      />
    </div>
  );
}

export function PreferencesDialog() {
  const t = useTranslations('consent');
  const { consent, save, preferencesOpen, closePreferences } = useConsent();
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (preferencesOpen && !d.open) {
      setAnalytics(consent.analytics);
      setAdvertising(consent.advertising);
      d.showModal();
    } else if (!preferencesOpen && d.open) d.close();
  }, [preferencesOpen, consent.analytics, consent.advertising]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${uid}-title`}
      onClose={closePreferences}
      onCancel={closePreferences}
      className="m-auto w-[min(92vw,34rem)] rounded-card border border-border bg-card p-0 text-fg shadow-pop backdrop:bg-black/50"
    >
      <div className="space-y-4 p-6">
        <h2 id={`${uid}-title`} className="text-xl font-bold">
          {t('preferencesTitle')}
        </h2>
        <p className="text-sm text-muted">
          {hasOptionalTracking ? t('preferencesIntro') : t('onlyEssential')}
        </p>
        <div className="rounded-control border border-border bg-subtle p-4">
          <p className="font-semibold">{t('essentialTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('essentialDescription')}</p>
        </div>
        {analyticsEnabled && (
          <Toggle
            id={`${uid}-an`}
            label={t('analyticsTitle')}
            description={t('analyticsDescription')}
            checked={analytics}
            onChange={setAnalytics}
          />
        )}
        {advertisingNeedsBuiltinConsent && (
          <Toggle
            id={`${uid}-ad`}
            label={t('advertisingTitle')}
            description={t('advertisingDescription')}
            checked={advertising}
            onChange={setAdvertising}
          />
        )}
        <p className="text-sm">
          <Link
            href="/cookie-policy"
            className="text-primary-text underline"
            onClick={closePreferences}
          >
            {t('policyLink')}
          </Link>
        </p>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={closePreferences}>
            {t('close')}
          </Button>
          {hasOptionalTracking && (
            <>
              <Button
                variant="outline"
                onClick={() => save({ analytics: false, advertising: false })}
              >
                {t('rejectAll')}
              </Button>
              <Button
                onClick={() =>
                  save({
                    analytics: analyticsEnabled && analytics,
                    advertising: advertisingNeedsBuiltinConsent && advertising,
                  })
                }
              >
                {t('save')}
              </Button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

export function ConsentBanner() {
  const t = useTranslations('consent');
  const { consent, save, openPreferences } = useConsent();
  if (!hasOptionalTracking || consent.decided) return null;
  return (
    <section
      aria-label={t('bannerLabel')}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-card border border-border bg-card p-4 shadow-pop sm:p-5"
    >
      <p className="text-sm leading-relaxed">
        {t('bannerText')}{' '}
        <Link href="/cookie-policy" className="text-primary-text underline">
          {t('policyLink')}
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Accept and reject carry equal visual weight. */}
        <Button variant="outline" onClick={() => save({ analytics: false, advertising: false })}>
          {t('rejectAll')}
        </Button>
        <Button variant="outline" onClick={openPreferences}>
          {t('manage')}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            save({ analytics: analyticsEnabled, advertising: advertisingNeedsBuiltinConsent })
          }
        >
          {t('acceptAll')}
        </Button>
      </div>
    </section>
  );
}
