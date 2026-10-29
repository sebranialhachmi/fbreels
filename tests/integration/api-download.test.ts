import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRateLimiter, resetRateLimiterForTests } from '@/lib/rate-limit';
import { SafeFetchError } from '@/lib/security/safe-fetch';
import { issueDownloadToken } from '@/lib/security/token';

const SECRET = 'k'.repeat(40);
const nowS = () => Math.floor(Date.now() / 1000);

const safeFetchMock = vi.fn();
vi.mock('@/lib/security/safe-fetch', async (orig) => {
  const actual = await orig<typeof import('@/lib/security/safe-fetch')>();
  return { ...actual, safeFetch: (...args: unknown[]) => safeFetchMock(...args) };
});

async function GET(query: string) {
  const { GET: handler } = await import('@/app/api/download/route');
  return handler(
    new Request(`http://localhost:3000/api/download${query}`, {
      headers: { 'x-forwarded-for': '198.51.100.20' },
    }),
  );
}

const token = (over: Partial<Parameters<typeof issueDownloadToken>[0]> = {}) =>
  issueDownloadToken(
    {
      upstreamUrl: 'https://cdn.example.com/v.mp4',
      expiresAt: nowS() + 600,
      filename: 'clip-HD.mp4',
      mimeType: 'video/mp4',
      ...over,
    },
    SECRET,
  );

beforeEach(() => {
  vi.stubEnv('DOWNLOAD_TOKEN_SECRET', SECRET);
  resetRateLimiterForTests(new MemoryRateLimiter());
  safeFetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetRateLimiterForTests(undefined);
});

describe('GET /api/download', () => {
  it('streams an allowlisted media type with safe, non-sniffable download headers', async () => {
    safeFetchMock.mockResolvedValue({
      response: new Response('VIDEODATA', {
        headers: { 'content-type': 'video/mp4', 'content-length': '9' },
      }),
      finalUrl: new URL('https://cdn.example.com/v.mp4'),
      redirects: 0,
    });
    const res = await GET(`?t=${token()}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('VIDEODATA');
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="clip-HD\.mp4"/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(safeFetchMock.mock.calls[0]![0]).toBe('https://cdn.example.com/v.mp4');
  });

  it('is not an open proxy: URL-like parameters are ignored, only the token decides the destination', async () => {
    safeFetchMock.mockResolvedValue({
      response: new Response('x', { headers: { 'content-type': 'video/mp4' } }),
      finalUrl: new URL('https://cdn.example.com/v.mp4'),
      redirects: 0,
    });
    await GET(
      `?t=${token()}&url=${encodeURIComponent('http://169.254.169.254/')}&u=https://evil.com`,
    );
    expect(safeFetchMock).toHaveBeenCalledTimes(1);
    expect(safeFetchMock.mock.calls[0]![0]).toBe('https://cdn.example.com/v.mp4');
    const noToken = await GET(`?url=${encodeURIComponent('https://evil.com/x')}`);
    expect(noToken.status).toBe(410);
    expect(safeFetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns TOKEN_EXPIRED (410) for expired, tampered or missing tokens', async () => {
    for (const q of [
      `?t=${token({ expiresAt: nowS() - 1 })}`,
      `?t=${token().slice(0, -3)}AAA`,
      '?t=',
      '',
      '?t=garbage',
    ]) {
      const res = await GET(q);
      expect(res.status).toBe(410);
      expect((await res.json()).error.code).toBe('TOKEN_EXPIRED');
    }
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it('rejects upstream responses that are not an allowlisted media type (e.g. HTML)', async () => {
    for (const type of [
      'text/html',
      'application/javascript',
      'text/plain',
      'application/octet-stream',
      '',
    ]) {
      safeFetchMock.mockResolvedValue({
        response: new Response('<script>', { headers: type ? { 'content-type': type } : {} }),
        finalUrl: new URL('https://cdn.example.com/v'),
        redirects: 0,
      });
      const res = await GET(`?t=${token()}`);
      expect(res.status).toBe(503);
    }
  });

  it('rejects oversized declared bodies and upstream errors', async () => {
    safeFetchMock.mockResolvedValue({
      response: new Response('x', {
        headers: { 'content-type': 'video/mp4', 'content-length': String(10 * 1024 * 1024 * 1024) },
      }),
      finalUrl: new URL('https://cdn.example.com/v'),
      redirects: 0,
    });
    expect((await GET(`?t=${token()}`)).status).toBe(503);
    safeFetchMock.mockResolvedValue({
      response: new Response('gone', { status: 404 }),
      finalUrl: new URL('https://cdn.example.com/v'),
      redirects: 0,
    });
    expect((await GET(`?t=${token()}`)).status).toBe(410);
    safeFetchMock.mockResolvedValue({
      response: new Response('err', { status: 500 }),
      finalUrl: new URL('https://cdn.example.com/v'),
      redirects: 0,
    });
    expect((await GET(`?t=${token()}`)).status).toBe(503);
  });

  it('maps SSRF/network blocks to safe errors without details', async () => {
    safeFetchMock.mockRejectedValue(new SafeFetchError('BLOCKED_ADDRESS'));
    const res = await GET(`?t=${token({ upstreamUrl: 'https://rebind.example.com/v.mp4' })}`);
    expect(res.status).toBe(503);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain('BLOCKED_ADDRESS');
    safeFetchMock.mockRejectedValue(new SafeFetchError('TIMEOUT'));
    expect((await GET(`?t=${token()}`)).status).toBe(504);
  });

  it('derives the file extension from the real content type and never trusts the token filename extension', async () => {
    safeFetchMock.mockResolvedValue({
      response: new Response('x', { headers: { 'content-type': 'audio/mpeg' } }),
      finalUrl: new URL('https://cdn.example.com/a'),
      redirects: 0,
    });
    const res = await GET(`?t=${token({ filename: 'x-Audio.mp4', mimeType: 'audio/mp4' })}`);
    expect(res.headers.get('content-disposition')).toContain('x-Audio.mp3');
  });

  it('serves "mock:" references only in the test-only provider mode, never in production', async () => {
    const mockToken = token({
      upstreamUrl: 'mock:1:sd',
      mimeType: 'text/plain',
      filename: 'Test-SD.txt',
    });
    vi.stubEnv('MEDIA_EXTRACTOR_PROVIDER', 'mock');
    const ok = await GET(`?t=${mockToken}`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain('TEST-ONLY FILE');
    vi.stubEnv('MEDIA_EXTRACTOR_PROVIDER', 'http-json');
    expect((await GET(`?t=${mockToken}`)).status).toBe(410);
    vi.stubEnv('MEDIA_EXTRACTOR_PROVIDER', 'mock');
    vi.stubEnv('NODE_ENV', 'production');
    expect((await GET(`?t=${mockToken}`)).status).toBe(410);
  });

  it('rate-limits downloads per client', async () => {
    safeFetchMock.mockImplementation(async () => ({
      response: new Response('x', { headers: { 'content-type': 'video/mp4' } }),
      finalUrl: new URL('https://cdn.example.com/v'),
      redirects: 0,
    }));
    let last = 200;
    for (let i = 0; i < 25; i++) last = (await GET(`?t=${token()}`)).status;
    expect(last).toBe(429);
  });
});
