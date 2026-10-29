import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { log } from '@/lib/logger';
import type { MediaExtractor } from './media-extractor';
import type { ProviderMedia } from '@/types/media';

/**
 * Adapter for a self-hosted or third-party extraction service that speaks a small,
 * documented JSON contract (see docs/provider-contract.md). It is "provider-ready":
 * it has been tested against a local fake server in the test-suite, NOT against any real
 * extraction service. Credentials stay server-side.
 */

const upstreamFormat = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['video', 'audio']),
  quality: z.string().min(1).max(32),
  mimeType: z.string().max(100).nullish(),
  size: z.number().int().positive().nullish(),
  url: z.string().url().max(4000),
  expiresAt: z.string().datetime().nullish(),
});

const upstreamSuccess = z.object({
  title: z.string().max(300).nullish(),
  thumbnail: z.string().url().max(2048).nullish(),
  duration: z.number().nonnegative().nullish(),
  formats: z.array(upstreamFormat).max(20),
});

const upstreamError = z.object({ error: z.object({ code: z.string() }) });

const ERROR_MAP: Record<string, ConstructorParameters<typeof AppError>[0]> = {
  PRIVATE_OR_INACCESSIBLE_CONTENT: 'PRIVATE_OR_INACCESSIBLE_CONTENT',
  CONTENT_UNAVAILABLE: 'CONTENT_UNAVAILABLE',
  NO_SUPPORTED_FORMATS: 'NO_SUPPORTED_FORMATS',
  UNSUPPORTED_URL: 'UNSUPPORTED_URL',
  RATE_LIMITED: 'PROVIDER_UNAVAILABLE',
};

export type HttpJsonProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  expandShortLinks?: boolean;
  fetchImpl?: typeof fetch;
};

export class HttpJsonExtractor implements MediaExtractor {
  readonly id = 'http-json';
  readonly requiresExpandedUrl: boolean;
  private endpoint: string;

  constructor(private cfg: HttpJsonProviderConfig) {
    let u: URL;
    try {
      u = new URL(cfg.baseUrl);
    } catch {
      throw new AppError('SERVER_CONFIGURATION_ERROR');
    }
    // Operator-supplied, but still held to https (http only for localhost development).
    const localDev = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(localDev && process.env.NODE_ENV !== 'production')) {
      throw new AppError('SERVER_CONFIGURATION_ERROR');
    }
    this.endpoint = u.toString();
    this.requiresExpandedUrl = cfg.expandShortLinks ?? false;
  }

  async resolve({ url, signal }: { url: string; signal?: AbortSignal }): Promise<ProviderMedia> {
    const timeout = AbortSignal.timeout(this.cfg.timeoutMs ?? 20_000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await (this.cfg.fetchImpl ?? fetch)(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(this.cfg.apiKey ? { authorization: `Bearer ${this.cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({ url }),
        redirect: 'error',
        signal: combined,
      });
    } catch (err) {
      if (timeout.aborted) throw new AppError('REQUEST_TIMEOUT');
      log('warn', 'provider_network_error', { provider: this.id, name: (err as Error).name });
      throw new AppError('PROVIDER_UNAVAILABLE');
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      log('warn', 'provider_bad_json', { provider: this.id, status: res.status });
      throw new AppError('PROVIDER_UNAVAILABLE');
    }

    if (!res.ok) {
      const parsed = upstreamError.safeParse(json);
      const mapped = parsed.success ? ERROR_MAP[parsed.data.error.code] : undefined;
      log('warn', 'provider_error', {
        provider: this.id,
        status: res.status,
        code: parsed.success ? parsed.data.error.code : 'unparsed',
      });
      if (res.status === 401 || res.status === 403) {
        if (!mapped) throw new AppError('SERVER_CONFIGURATION_ERROR'); // bad API key on our side
      }
      if (res.status === 429) throw new AppError('PROVIDER_UNAVAILABLE');
      throw new AppError(mapped ?? 'PROVIDER_UNAVAILABLE');
    }

    const parsed = upstreamSuccess.safeParse(json);
    if (!parsed.success) {
      log('warn', 'provider_schema_mismatch', { provider: this.id });
      throw new AppError('PROVIDER_UNAVAILABLE');
    }
    const data = parsed.data;
    const formats = data.formats
      .filter((f) => f.url.startsWith('https://'))
      .map((f) => ({
        id: f.id,
        type: f.type,
        quality: f.quality,
        mimeType: f.mimeType ?? null,
        size: f.size ?? null,
        upstreamUrl: f.url,
        expiresAt: f.expiresAt ? new Date(f.expiresAt) : null,
      }));
    return {
      title: data.title ?? null,
      thumbnail: data.thumbnail && data.thumbnail.startsWith('https://') ? data.thumbnail : null,
      duration: data.duration ?? null,
      source: this.id,
      formats,
    };
  }
}
