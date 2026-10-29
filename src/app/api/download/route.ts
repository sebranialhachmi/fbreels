import { AppError } from '@/lib/errors';
import { enforceRateLimit, errorResponse, toErrorResponse } from '@/lib/api';
import { log } from '@/lib/logger';
import { mockPayload } from '@/lib/providers/mock-provider';
import { ALLOWED_MIME_TYPES, contentDisposition, extensionForMime } from '@/lib/security/filename';
import { SafeFetchError, limitStream, safeFetch } from '@/lib/security/safe-fetch';
import { getTokenSecret, openDownloadToken } from '@/lib/security/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LIMIT = Number(process.env.DOWNLOAD_RATE_LIMIT) || 20;
const WINDOW = Number(process.env.DOWNLOAD_RATE_WINDOW_SECONDS) || 60;
const MAX_BYTES = (Number(process.env.DOWNLOAD_MAX_MB) || 512) * 1024 * 1024;
const HOST_ALLOWLIST = (process.env.MEDIA_DOWNLOAD_HOST_ALLOWLIST ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'Referrer-Policy': 'no-referrer',
} as const;

function hostAllowed(url: URL): boolean {
  if (HOST_ALLOWLIST.length === 0) return true; // still subject to IP/protocol/redirect checks
  const h = url.hostname.toLowerCase();
  return HOST_ALLOWLIST.some((a) => h === a || h.endsWith(`.${a}`));
}

/**
 * Streams a file referenced by an encrypted, expiring token issued by /api/extract.
 * The destination is taken ONLY from the token, never from a user-supplied parameter,
 * so this is not an open proxy.
 */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(req, 'download', LIMIT, WINDOW);
    const token = new URL(req.url).searchParams.get('t') ?? '';
    const payload = openDownloadToken(token, getTokenSecret());

    if (payload.upstreamUrl.startsWith('mock:')) {
      if (
        process.env.NODE_ENV === 'production' ||
        process.env.MEDIA_EXTRACTOR_PROVIDER !== 'mock'
      ) {
        throw new AppError('TOKEN_EXPIRED');
      }
      const { body, mime } = mockPayload(payload.upstreamUrl);
      return new Response(body, {
        headers: {
          ...BASE_HEADERS,
          'Content-Type': mime,
          'Content-Disposition': contentDisposition(payload.filename),
          'Content-Length': String(Buffer.byteLength(body)),
        },
      });
    }

    const { response } = await safeFetch(payload.upstreamUrl, {
      isAllowedUrl: hostAllowed,
      maxRedirects: 3,
      timeoutMs: 30_000,
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError(
        response.status === 404 || response.status === 410
          ? 'TOKEN_EXPIRED'
          : 'PROVIDER_UNAVAILABLE',
      );
    }
    const upstreamType = (response.headers.get('content-type') ?? '')
      .toLowerCase()
      .split(';')[0]!
      .trim();
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (!ALLOWED_MIME_TYPES.includes(upstreamType) || upstreamType === 'text/plain') {
      await response.body.cancel().catch(() => undefined);
      throw new AppError('PROVIDER_UNAVAILABLE');
    }
    if (declaredLength > MAX_BYTES) {
      await response.body.cancel().catch(() => undefined);
      throw new AppError('PROVIDER_UNAVAILABLE');
    }
    // Filename extension follows the actual (allowlisted) content type.
    const ext = extensionForMime(upstreamType) ?? 'bin';
    const filename = payload.filename.replace(/\.[A-Za-z0-9]+$/, `.${ext}`);
    const headers: Record<string, string> = {
      ...BASE_HEADERS,
      'Content-Type': upstreamType,
      'Content-Disposition': contentDisposition(filename),
    };
    if (declaredLength > 0) headers['Content-Length'] = String(declaredLength);
    return new Response(limitStream(response.body, MAX_BYTES), { headers });
  } catch (err) {
    if (err instanceof SafeFetchError) {
      log('warn', 'download_blocked', { reason: err.reason });
      return errorResponse(err.reason === 'TIMEOUT' ? 'REQUEST_TIMEOUT' : 'PROVIDER_UNAVAILABLE');
    }
    return toErrorResponse(err);
  }
}
