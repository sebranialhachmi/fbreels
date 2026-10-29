'use client';

import { ClipboardPaste, Download, RotateCw, Search, X } from 'lucide-react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useId, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { isErrorCode, type ErrorCode } from '@/lib/errors';
import { track } from '@/lib/analytics/track';
import { parseFacebookUrl } from '@/lib/validation/facebook-url';
import type { ResolvedMediaPublic } from '@/types/media';
import { ResultCard } from './result-card';

type UiErrorCode = ErrorCode | 'EMPTY' | 'NETWORK_ERROR';

type State =
  | { status: 'idle' }
  | { status: 'invalid'; code: UiErrorCode }
  | { status: 'loading' }
  | { status: 'success'; media: ResolvedMediaPublic }
  | { status: 'error'; code: UiErrorCode; retryAfter?: number };

const CLIENT_TIMEOUT_MS = 40_000;

export function Downloader() {
  const t = useTranslations('downloader');
  const locale = useLocale();
  const reduce = useReducedMotion();
  const inputId = useId();
  const hintId = useId();
  const errId = useId();
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [value, setValue] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const [clipboardNote, setClipboardNote] = useState<string | null>(null);

  const submit = useCallback(async (raw: string) => {
    if (busy.current) return; // block duplicate submissions
    setClipboardNote(null);
    if (!raw.trim()) {
      setState({ status: 'invalid', code: 'EMPTY' });
      input.current?.focus();
      return;
    }
    const parsed = parseFacebookUrl(raw);
    if (!parsed.ok) {
      if (parsed.code === 'UNSUPPORTED_URL') track('unsupported_link');
      setState({ status: 'invalid', code: parsed.code });
      input.current?.focus();
      return;
    }
    busy.current = true;
    setState({ status: 'loading' });
    track('download_attempt');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: raw.trim() }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as
        | { success: true; media: ResolvedMediaPublic }
        | { success: false; error?: { code?: string; retryAfterSeconds?: number } }
        | null;
      if (
        res.ok &&
        data &&
        data.success === true &&
        Array.isArray(data.media?.formats) &&
        data.media.formats.length > 0
      ) {
        track('media_resolved');
        setState({ status: 'success', media: data.media });
      } else {
        const code =
          data && data.success === false && isErrorCode(data.error?.code)
            ? data.error.code
            : 'INTERNAL_ERROR';
        if (
          code === 'PROVIDER_UNAVAILABLE' ||
          code === 'SERVER_CONFIGURATION_ERROR' ||
          code === 'INTERNAL_ERROR'
        )
          track('provider_error');
        setState({
          status: 'error',
          code,
          retryAfter: data && data.success === false ? data.error?.retryAfterSeconds : undefined,
        });
      }
    } catch (err) {
      setState({
        status: 'error',
        code: (err as Error).name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      });
    } finally {
      clearTimeout(timer);
      busy.current = false;
    }
  }, []);

  async function paste() {
    setClipboardNote(null);
    try {
      if (!navigator.clipboard?.readText) throw new Error('unsupported');
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setClipboardNote(t('clipboardEmpty'));
        return;
      }
      setValue(text.trim()); // never auto-submitted: the user must press the main button
      setState({ status: 'idle' });
      input.current?.focus();
    } catch {
      setClipboardNote(t('clipboardFailed'));
      input.current?.focus();
    }
  }

  function clear() {
    setValue('');
    setState({ status: 'idle' });
    setClipboardNote(null);
    input.current?.focus();
  }

  const loading = state.status === 'loading';
  const invalid = state.status === 'invalid';
  const errorMessage =
    state.status === 'invalid' || state.status === 'error'
      ? t(`errors.${state.code}`, {
          seconds: state.status === 'error' ? (state.retryAfter ?? 60) : 60,
        })
      : null;

  return (
    <LazyMotion features={domAnimation}>
      <Card className="p-4 sm:p-6">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit(value);
          }}
          aria-busy={loading}
        >
          <label htmlFor={inputId} className="mb-2 block text-sm font-semibold">
            {t('label')}
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input
                ref={input}
                id={inputId}
                name="url"
                type="text"
                inputMode="url"
                dir="ltr"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={2048}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (state.status === 'invalid') setState({ status: 'idle' });
                }}
                placeholder={t('placeholder')}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `${hintId} ${errId}` : hintId}
                className="h-12 w-full rounded-control border border-border bg-bg ps-3 pe-20 text-base text-fg placeholder:text-muted/80 aria-[invalid=true]:border-danger"
              />
              <div className="absolute inset-y-0 end-1 flex items-center gap-0.5">
                {value && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    onClick={clear}
                    aria-label={t('clear')}
                    title={t('clear')}
                    disabled={loading}
                  >
                    <X aria-hidden className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={paste}
                  aria-label={t('paste')}
                  title={t('paste')}
                  disabled={loading}
                >
                  <ClipboardPaste aria-hidden className="size-4" />
                </Button>
              </div>
            </div>
            <Button type="submit" size="lg" disabled={loading} className="sm:min-w-40">
              {loading ? <Spinner /> : <Download aria-hidden className="size-5" />}
              {loading ? t('checking') : t('submit')}
            </Button>
          </div>
          <p id={hintId} className="mt-3 text-xs leading-relaxed text-muted">
            {t('hint')}
          </p>
          {clipboardNote && (
            <p role="status" className="mt-2 text-sm text-warning-text">
              {clipboardNote}
            </p>
          )}
          {invalid && errorMessage && (
            <p id={errId} role="alert" className="mt-3 text-sm font-medium text-danger-text">
              {errorMessage}
            </p>
          )}
        </form>

        {/* Screen-reader announcements for state changes */}
        <div className="sr-only" role="status" aria-live="polite">
          {loading ? t('checkingStatus') : state.status === 'success' ? t('resultReady') : ''}
        </div>

        {loading && (
          <div className="mt-6 flex gap-4" aria-hidden="true" data-testid="loading-skeleton">
            <div className="skeleton h-24 w-40 shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-10 w-full" />
            </div>
          </div>
        )}

        {state.status === 'error' && errorMessage && (
          <div className="mt-6 space-y-3" data-testid="error-panel">
            <Alert tone="error" title={t('errorTitle')}>
              {errorMessage}
            </Alert>
            <Button variant="outline" onClick={() => void submit(value)} disabled={loading}>
              <RotateCw aria-hidden className="size-4 rtl-flip" />
              {t('retry')}
            </Button>
          </div>
        )}

        {state.status === 'success' && (
          <m.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-6"
          >
            <ResultCard
              media={state.media}
              locale={locale}
              onExpired={() => setState({ status: 'error', code: 'TOKEN_EXPIRED' })}
            />
          </m.div>
        )}

        {state.status === 'idle' && !value && (
          <p className="mt-4 flex items-center gap-2 text-xs text-muted">
            <Search aria-hidden className="size-4" />
            {t('idleNote')}
          </p>
        )}
      </Card>
    </LazyMotion>
  );
}
