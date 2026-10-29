import { analyticsEnabled } from '@/lib/consent/config';

type EventName =
  | 'download_attempt'
  | 'media_resolved'
  | 'unsupported_link'
  | 'provider_error'
  | 'language_selected'
  | 'contact_submitted';

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}

/**
 * High-level events only. Never pass URLs, titles or free text. A no-op unless analytics is
 * configured AND the visitor consented (the script is not even loaded otherwise).
 */
export function track(event: EventName, props?: Record<string, string | number | boolean>) {
  if (!analyticsEnabled || typeof window === 'undefined') return;
  window.plausible?.(event, props ? { props } : undefined);
}
