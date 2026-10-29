import { AppError } from '@/lib/errors';
import type { MediaExtractor } from './media-extractor';
import { MockExtractor } from './mock-provider';
import { HttpJsonExtractor } from './http-json-provider';

/**
 * Selects the extractor from MEDIA_EXTRACTOR_PROVIDER:
 *   (unset) | "none"  -> no provider: extract returns SERVER_CONFIGURATION_ERROR
 *   "mock"            -> test-only mock; refused when NODE_ENV=production
 *   "http-json"       -> generic HTTP adapter (MEDIA_EXTRACTOR_BASE_URL, MEDIA_EXTRACTOR_API_KEY)
 * Adding an approved provider = add a class implementing MediaExtractor and a case here.
 */
export function getExtractor(env: NodeJS.ProcessEnv = process.env): MediaExtractor {
  const name = env.MEDIA_EXTRACTOR_PROVIDER?.trim().toLowerCase() || 'none';
  switch (name) {
    case 'mock':
      if (env.NODE_ENV === 'production') throw new AppError('SERVER_CONFIGURATION_ERROR');
      return new MockExtractor();
    case 'http-json': {
      const baseUrl = env.MEDIA_EXTRACTOR_BASE_URL?.trim();
      if (!baseUrl) throw new AppError('SERVER_CONFIGURATION_ERROR');
      return new HttpJsonExtractor({
        baseUrl,
        apiKey: env.MEDIA_EXTRACTOR_API_KEY?.trim() || undefined,
        timeoutMs: Number(env.MEDIA_EXTRACTOR_TIMEOUT_MS) || undefined,
        expandShortLinks: env.MEDIA_EXTRACTOR_EXPAND_LINKS === 'true',
      });
    }
    case 'none':
      throw new AppError('SERVER_CONFIGURATION_ERROR');
    default:
      throw new AppError('SERVER_CONFIGURATION_ERROR');
  }
}
