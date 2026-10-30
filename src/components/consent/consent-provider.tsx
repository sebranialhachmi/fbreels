'use client';

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import { CONSENT_EVENT, CONSENT_STORAGE_KEY, NO_CONSENT, type ConsentState } from '@/lib/consent/config';

type Ctx = {
  consent: ConsentState;
  save: (next: { analytics: boolean; advertising: boolean }) => void;
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
};

const ConsentContext = createContext<Ctx | null>(null);

let cachedRaw: string | null | undefined;
let cachedState: ConsentState = NO_CONSENT;

function readSnapshot(): ConsentState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    /* storage blocked: treated as "no decision", optional tracking stays off */
  }
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  try {
    const p = raw ? (JSON.parse(raw) as Partial<ConsentState>) : null;
    cachedState = p ? { analytics: p.analytics === true, advertising: p.advertising === true, decided: true } : NO_CONSENT;
  } catch {
    cachedState = NO_CONSENT;
  }
  return cachedState;
}

function subscribe(cb: () => void) {
  window.addEventListener(CONSENT_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CONSENT_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const consent = useSyncExternalStore(subscribe, readSnapshot, () => NO_CONSENT);
  const [preferencesOpen, setOpen] = useState(false);

  const save = useCallback((next: { analytics: boolean; advertising: boolean }) => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ ...next, ts: Date.now() }));
    } catch {
      /* cannot persist; notify anyway so this page view still respects the choice */
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
    setOpen(false);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ consent, save, preferencesOpen, openPreferences: () => setOpen(true), closePreferences: () => setOpen(false) }),
    [consent, save, preferencesOpen],
  );
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): Ctx {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used inside ConsentProvider');
  return ctx;
}
