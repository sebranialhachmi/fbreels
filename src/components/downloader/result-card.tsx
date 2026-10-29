'use client';

import { Clock, Download, FlaskConical, Music, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import type { ResolvedMediaPublic } from '@/types/media';
import { formatDuration, formatSize, formatTime } from './format-utils';

export function ResultCard({
  media,
  locale,
  onExpired,
}: {
  media: ResolvedMediaPublic;
  locale: string;
  onExpired: () => void;
}) {
  const t = useTranslations('downloader');
  const earliestExpiry = media.formats
    .map((f) => f.expiresAt)
    .filter((v): v is string => !!v)
    .sort()[0];

  return (
    <div data-testid="result-card" className="space-y-4">
      {media.source === 'mock' && (
        <Alert tone="warning" title={t('mockTitle')}>
          <span className="inline-flex items-center gap-1.5">
            <FlaskConical aria-hidden className="size-4" />
            {t('mockBody')}
          </span>
        </Alert>
      )}
      <div className="flex gap-4">
        {media.thumbnail && (
          // Provider-supplied thumbnail: plain <img> (host unknown at build time), no referrer, fixed box.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.thumbnail}
            alt={t('thumbnailAlt')}
            width={160}
            height={96}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-24 w-40 shrink-0 rounded-control border border-border object-cover"
          />
        )}
        <div className="min-w-0">
          <h3 className="line-clamp-2 break-words text-lg font-bold" dir="auto">
            {media.title ?? t('untitled')}
          </h3>
          {media.duration !== null && (
            <p className="mt-1 text-sm text-muted">
              <span className="sr-only">{t('duration')}: </span>
              <bdi>{formatDuration(media.duration)}</bdi>
            </p>
          )}
        </div>
      </div>

      <ul className="space-y-2" aria-label={t('formatsLabel')}>
        {media.formats.map((f) => {
          const Icon = f.type === 'audio' ? Music : Video;
          return (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-bg p-3"
            >
              <div className="flex items-center gap-3">
                <Icon aria-hidden className="size-5 text-primary-text" />
                <div>
                  <p className="font-semibold">
                    {t(f.type === 'audio' ? 'audio' : 'video')} · <bdi>{f.quality}</bdi>
                  </p>
                  <p className="text-xs text-muted">
                    {[
                      f.mimeType ? f.mimeType.split('/')[1]?.toUpperCase() : null,
                      f.size ? formatSize(f.size, locale) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('sizeUnknown')}
                  </p>
                </div>
              </div>
              <a
                href={`/api/download?t=${encodeURIComponent(f.downloadToken)}`}
                download
                rel="nofollow noopener"
                onClick={(e) => {
                  if (f.expiresAt && Date.parse(f.expiresAt) <= Date.now()) {
                    e.preventDefault();
                    onExpired();
                  }
                }}
                className={buttonClasses('primary', 'md')}
              >
                <Download aria-hidden className="size-4" />
                {t('save')}
                <span className="sr-only">
                  {' '}
                  {t(f.type === 'audio' ? 'audio' : 'video')} {f.quality}
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      {earliestExpiry && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Clock aria-hidden className="size-4" />
          {t('expiresAt', { time: formatTime(earliestExpiry, locale) })}
        </p>
      )}
    </div>
  );
}
