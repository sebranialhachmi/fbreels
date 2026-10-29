'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { adPlacements, type AdPlacement } from '@/config/ads';
import { adsenseEnabled, adsensePublisherId, consentMode } from '@/lib/consent/config';
import { useConsent } from '@/components/consent/consent-provider';
import { cn } from '@/lib/cn';

const isDev = process.env.NODE_ENV !== 'production';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Policy-conscious ad container: always labelled, never inside the downloader card, kept well
 * away from download controls (callers must leave generous spacing), lazy-loaded, with reserved
 * height to avoid layout shift. Renders nothing in production until ads are really configured.
 */
export function AdSlot({ placement, className }: { placement: AdPlacement; className?: string }) {
  const cfg = adPlacements[placement];
  if (!cfg.enabled) return null;
  if (!adsenseEnabled || !cfg.slotId) {
    return isDev ? (
      <DevPlaceholder placement={placement} minHeight={cfg.minHeight} className={className} />
    ) : null;
  }
  return <LiveAd slotId={cfg.slotId} minHeight={cfg.minHeight} className={className} />;
}

function DevPlaceholder({
  placement,
  minHeight,
  className,
}: {
  placement: string;
  minHeight: number;
  className?: string;
}) {
  return (
    <div
      data-testid="ad-dev-placeholder"
      style={{ minHeight }}
      className={cn(
        'flex items-center justify-center rounded-card border border-dashed border-border text-xs text-muted',
        className,
      )}
    >
      DEV ONLY — ad placeholder: {placement}
    </div>
  );
}

function LiveAd({
  slotId,
  minHeight,
  className,
}: {
  slotId: string;
  minHeight: number;
  className?: string;
}) {
  const t = useTranslations('ads');
  const { consent } = useConsent();
  const allowed = consentMode === 'google-cmp' || consent.advertising;
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const pushed = useRef(false);

  useEffect(() => {
    if (!allowed || !box.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !visible || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ad blocked or script unavailable: the page works without ads */
    }
  }, [allowed, visible]);

  if (!allowed) return null;
  return (
    <aside
      ref={box}
      aria-label={t('label')}
      style={{ minHeight }}
      className={cn('mx-auto w-full max-w-3xl', className)}
    >
      <p className="mb-1 text-center text-[11px] uppercase tracking-wider text-muted">
        {t('label')}
      </p>
      {visible && (
        <ins
          className="adsbygoogle block"
          style={{ display: 'block', minHeight: minHeight - 20 }}
          data-ad-client={adsensePublisherId}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </aside>
  );
}
