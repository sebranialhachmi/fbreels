/**
 * What the site actually does, derived from configuration. The banner, the cookie
 * policy and the script loaders all read from here so they cannot drift apart.
 */
const publisher = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID?.trim() ?? '';
const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() ?? '';

export const ADSENSE_PUBLISHER_RE = /^ca-pub-\d{10,20}$/;

export const adsenseEnabled = ADSENSE_PUBLISHER_RE.test(publisher);
export const adsensePublisherId = adsenseEnabled ? publisher : '';
export const analyticsEnabled = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(plausible);
export const analyticsDomain = analyticsEnabled ? plausible : '';

/** builtin: ads load only after the built-in banner records advertising consent.
 *  google-cmp: a Google-certified CMP (Funding Choices / Privacy & messaging) handles consent. */
export const consentMode: 'builtin' | 'google-cmp' =
  process.env.NEXT_PUBLIC_CONSENT_MODE === 'google-cmp' ? 'google-cmp' : 'builtin';

export const advertisingNeedsBuiltinConsent = adsenseEnabled && consentMode === 'builtin';

/** Optional categories this deployment really uses. Empty => only essential storage. */
export const optionalCategories = [
  ...(analyticsEnabled ? (['analytics'] as const) : []),
  ...(advertisingNeedsBuiltinConsent ? (['advertising'] as const) : []),
];

export const hasOptionalTracking = optionalCategories.length > 0;

export const CONSENT_STORAGE_KEY = 'consent.v1';
export const CONSENT_EVENT = 'consent-change';

export type ConsentState = { analytics: boolean; advertising: boolean; decided: boolean };
export const NO_CONSENT: ConsentState = { analytics: false, advertising: false, decided: false };
