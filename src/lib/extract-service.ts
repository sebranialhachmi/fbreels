import { createHash } from 'node:crypto';
import { AppError } from '@/lib/errors';
import { Semaphore } from '@/lib/concurrency';
import { TtlCache } from '@/lib/cache/ttl-cache';
import { describeUrl, log } from '@/lib/logger';
import { getExtractor } from '@/lib/providers';
import type { MediaExtractor } from '@/lib/providers/media-extractor';
import { ALLOWED_MIME_TYPES, safeFilename } from '@/lib/security/filename';
import { SafeFetchError, safeFetch } from '@/lib/security/safe-fetch';
import { getTokenSecret, issueDownloadToken } from '@/lib/security/token';
import { isAllowedFacebookHostUrl, parseFacebookUrl } from '@/lib/validation/facebook-url';
import { brand } from '@/config/brand';
import { resolvedMediaSchema, type ProviderFormat, type ResolvedMediaPublic } from '@/types/media';

export const TOKEN_TTL_SECONDS = 15 * 60;
const RESULT_CACHE_TTL_MS = 5 * 60_000;

export type ExtractServiceOptions = {
  getExtractor?: () => MediaExtractor;
  tokenSecret?: () => string;
  now?: () => number;
  timeoutMs?: number;
  maxConcurrent?: number;
  expandUrl?: (url: string) => Promise<string>;
};

/** Follows a short/share link (SSRF-guarded, every hop re-validated) to its canonical form. */
export async function expandFacebookLink(url: string): Promise<string> {
  try {
    const { response, finalUrl } = await safeFetch(url, {
      isAllowedUrl: isAllowedFacebookHostUrl,
      method: 'GET',
      maxRedirects: 4,
      timeoutMs: 8000,
    });
    await response.body?.cancel().catch(() => undefined);
    const parsed = parseFacebookUrl(finalUrl.toString());
    if (!parsed.ok || parsed.kind === 'short' || parsed.kind === 'share')
      throw new AppError('UNSUPPORTED_URL');
    return parsed.url;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof SafeFetchError) {
      if (err.reason === 'TIMEOUT') throw new AppError('REQUEST_TIMEOUT');
      if (err.reason === 'NETWORK') throw new AppError('PROVIDER_UNAVAILABLE');
      throw new AppError('UNSUPPORTED_URL'); // blocked host/address/protocol/redirect
    }
    throw new AppError('INTERNAL_ERROR');
  }
}

export class ExtractService {
  private cache = new TtlCache<ResolvedMediaPublic>(RESULT_CACHE_TTL_MS);
  private inflight = new Map<string, Promise<ResolvedMediaPublic>>();
  private semaphore: Semaphore;
  private opts: Required<Pick<ExtractServiceOptions, 'now' | 'timeoutMs'>> & ExtractServiceOptions;

  constructor(opts: ExtractServiceOptions = {}) {
    this.opts = { now: Date.now, timeoutMs: 25_000, ...opts };
    this.semaphore = new Semaphore(
      opts.maxConcurrent ?? (Number(process.env.EXTRACT_MAX_CONCURRENCY) || 4),
    );
  }

  /** Validates, then resolves, de-duplicating concurrent identical requests and caching briefly. */
  async extract(rawUrl: unknown): Promise<ResolvedMediaPublic> {
    const parsed = parseFacebookUrl(rawUrl);
    if (!parsed.ok) throw new AppError(parsed.code);

    // Configuration problems surface before any work happens.
    const extractor = (this.opts.getExtractor ?? getExtractor)();
    const key = createHash('sha256').update(`${extractor.id}|${parsed.url}`).digest('hex');

    const cached = this.cache.get(key);
    if (cached) return cached;
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const started = this.opts.now();
    const work = this.semaphore
      .run(() => this.resolveFresh(extractor, parsed.url, parsed.kind))
      .then((media) => {
        this.cache.set(key, media);
        log('info', 'extract_ok', {
          provider: extractor.id,
          target: describeUrl(parsed.url),
          formats: media.formats.length,
          ms: this.opts.now() - started,
        });
        return media;
      })
      .catch((err: unknown) => {
        const e =
          err instanceof AppError
            ? err
            : err instanceof Error && err.message === 'QUEUE_FULL'
              ? new AppError('PROVIDER_UNAVAILABLE')
              : new AppError('INTERNAL_ERROR');
        log(e.code === 'INTERNAL_ERROR' ? 'error' : 'warn', 'extract_failed', {
          provider: extractor.id,
          code: e.code,
          target: describeUrl(parsed.url),
          ms: this.opts.now() - started,
        });
        throw e;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, work);
    return work;
  }

  private async resolveFresh(
    extractor: MediaExtractor,
    url: string,
    kind: string,
  ): Promise<ResolvedMediaPublic> {
    const secret = (this.opts.tokenSecret ?? getTokenSecret)();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      let target = url;
      if (extractor.requiresExpandedUrl && (kind === 'short' || kind === 'share')) {
        target = await this.raceTimeout(
          (this.opts.expandUrl ?? expandFacebookLink)(url),
          controller.signal,
        );
      }
      const media = await this.raceTimeout(
        extractor.resolve({ url: target, signal: controller.signal }),
        controller.signal,
      );
      const formats = this.toPublicFormats(media.title, media.formats, secret);
      if (formats.length === 0) throw new AppError('NO_SUPPORTED_FORMATS');
      return resolvedMediaSchema.parse({
        title: media.title,
        thumbnail: media.thumbnail,
        duration: media.duration,
        source: media.source,
        formats,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (controller.signal.aborted) throw new AppError('REQUEST_TIMEOUT');
      throw new AppError('INTERNAL_ERROR');
    } finally {
      clearTimeout(timer);
    }
  }

  private raceTimeout<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(new AppError('REQUEST_TIMEOUT'));
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
      p.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }

  private toPublicFormats(title: string | null, formats: ProviderFormat[], secret: string) {
    const nowMs = this.opts.now();
    const seen = new Set<string>();
    const out = [];
    for (const f of formats) {
      if (seen.has(f.id)) continue;
      const mime = (f.mimeType ?? (f.type === 'audio' ? 'audio/mp4' : 'video/mp4'))
        .toLowerCase()
        .split(';')[0]!
        .trim();
      if (!ALLOWED_MIME_TYPES.includes(mime)) continue;
      if (f.upstreamUrl.startsWith('mock:')) {
        if (process.env.NODE_ENV === 'production') continue;
      } else if (!f.upstreamUrl.startsWith('https://')) continue;
      const providerExpiry = f.expiresAt ? f.expiresAt.getTime() : Infinity;
      const expiresMs = Math.min(providerExpiry, nowMs + TOKEN_TTL_SECONDS * 1000);
      if (expiresMs <= nowMs + 5_000) continue; // already (almost) expired
      seen.add(f.id);
      out.push({
        id: f.id,
        type: f.type,
        quality: f.quality,
        mimeType: f.mimeType ? mime : null,
        size: f.size,
        expiresAt: new Date(expiresMs).toISOString(),
        downloadToken: issueDownloadToken(
          {
            upstreamUrl: f.upstreamUrl,
            expiresAt: Math.floor(expiresMs / 1000),
            filename: safeFilename(title, f.quality, mime, brand.name),
            mimeType: mime,
            size: f.size ?? undefined,
          },
          secret,
        ),
      });
    }
    return out;
  }
}

let service: ExtractService | undefined;
export function getExtractService(): ExtractService {
  return (service ??= new ExtractService());
}
