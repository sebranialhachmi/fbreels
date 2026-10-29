import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, GET } from '@/app/api/extract/route';
import { MemoryRateLimiter, resetRateLimiterForTests } from '@/lib/rate-limit';
import { errorResponseSchema, extractSuccessSchema } from '@/types/media';

const url = (id: string) => `https://www.facebook.com/reel/${id}`;

function req(body: unknown, headers: Record<string, string> = {}, raw = false) {
  return new Request('http://localhost:3000/api/extract', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'localhost:3000',
      'x-forwarded-for': '198.51.100.9',
      ...headers,
    },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

async function call(r: Request) {
  const res = await POST(r);
  return { status: res.status, json: await res.json(), headers: res.headers };
}

beforeEach(() => {
  vi.stubEnv('DOWNLOAD_TOKEN_SECRET', 'k'.repeat(40));
  resetRateLimiterForTests(new MemoryRateLimiter());
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetRateLimiterForTests(undefined);
});

describe('POST /api/extract — no provider configured', () => {
  it('returns SERVER_CONFIGURATION_ERROR (503) for a valid link, never a fake success', async () => {
    vi.stubEnv('MEDIA_EXTRACTOR_PROVIDER', '');
    const { status, json } = await call(req({ url: url('1234567890') }));
    expect(status).toBe(503);
    expect(errorResponseSchema.parse(json).error.code).toBe('SERVER_CONFIGURATION_ERROR');
    expect(json.media).toBeUndefined();
  });
});

describe('POST /api/extract — input validation', () => {
  beforeEach(() => vi.stubEnv('MEDIA_EXTRACTOR_PROVIDER', 'mock'));

  it.each([
    [{ url: 'https://evil.com/reel/1234567' }, 422, 'UNSUPPORTED_URL'],
    [{ url: 'https://facebook.com.evil.com/reel/1234567' }, 422, 'UNSUPPORTED_URL'],
    [{ url: 'https://www.facebook.com@evil.com/reel/1234567' }, 400, 'INVALID_URL'],
    [{ url: 'javascript:alert(1)' }, 400, 'INVALID_URL'],
    [{ url: 'http://169.254.169.254/latest/meta-data' }, 422, 'UNSUPPORTED_URL'],
    [{ url: '' }, 400, 'INVALID_URL'],
    [{}, 400, 'INVALID_URL'],
    [{ url: 123 }, 400, 'INVALID_URL'],
    [{ url: url('1234567890'), extra: 'x' }, 400, 'INVALID_URL'],
    [[], 400, 'INVALID_URL'],
    [null, 400, 'INVALID_URL'],
  ])('%j -> %i %s', async (body, status, code) => {
    const r = await call(req(body));
    expect(r.status).toBe(status);
    expect(r.json.error.code).toBe(code);
  });

  it('rejects malformed JSON, wrong content-type and oversized bodies', async () => {
    expect((await call(req('{not json', {}, true))).json.error.code).toBe('INVALID_URL');
    expect(
      (await call(req({ url: url('1234567890') }, { 'content-type': 'text/plain' }))).json.error
        .code,
    ).toBe('INVALID_URL');
    const big = await call(req({ url: url('1234567890'), pad: 'x'.repeat(20_000) }));
    expect(big.status).toBe(400);
  });

  it('rejects cross-origin browser requests (CSRF)', async () => {
    const r = await call(req({ url: url('1234567890') }, { origin: 'https://evil.example' }));
    expect(r.status).toBe(403);
    expect(r.json.success).toBe(false);
    const same = await call(req({ url: url('1234567891') }, { origin: 'http://localhost:3000' }));
    expect(same.status).toBe(200);
  });

  it('only allows POST', async () => {
    expect(GET().status).toBe(405);
  });
});

describe('POST /api/extract — with the test-only mock provider', () => {
  beforeEach(() => vi.stubEnv('MEDIA_EXTRACTOR_PROVIDER', 'mock'));

  it('returns a schema-valid, clearly-labelled mock result with opaque download tokens', async () => {
    const { status, json, headers } = await call(req({ url: url('5550000001') }));
    expect(status).toBe(200);
    const parsed = extractSuccessSchema.parse(json);
    expect(parsed.media.source).toBe('mock');
    expect(parsed.media.formats.length).toBeGreaterThan(0);
    expect(JSON.stringify(json)).not.toContain('mock:'); // internal reference never leaks
    expect(headers.get('cache-control')).toBe('no-store');
  });

  it('returns HD, SD and audio only when the provider reports them', async () => {
    const { json } = await call(req({ url: url('9990006') }));
    expect(json.media.formats.map((f: { quality: string }) => f.quality)).toEqual([
      'HD',
      'SD',
      'Audio',
    ]);
    const plain = await call(req({ url: url('5550000002') }));
    expect(plain.json.media.formats.map((f: { quality: string }) => f.quality)).toEqual(['SD']);
  });

  it.each([
    ['9990001', 403, 'PRIVATE_OR_INACCESSIBLE_CONTENT'],
    ['9990002', 404, 'CONTENT_UNAVAILABLE'],
    ['9990003', 422, 'NO_SUPPORTED_FORMATS'],
    ['9990004', 503, 'PROVIDER_UNAVAILABLE'],
    ['9990005', 504, 'REQUEST_TIMEOUT'],
  ])('maps provider scenario %s -> %i %s', async (id, status, code) => {
    const r = await call(req({ url: url(id) }));
    expect(r.status).toBe(status);
    expect(r.json).toEqual({ success: false, error: { code } });
  });

  it('never leaks internals in error bodies', async () => {
    const r = await call(req({ url: 'https://evil.com/x' }));
    expect(JSON.stringify(r.json)).not.toMatch(/stack|Error:|at \w+ \(|node_modules|\/home\//);
  });
});

describe('POST /api/extract — rate limiting', () => {
  it('returns RATE_LIMITED with Retry-After after the per-IP limit, and isolates other clients', async () => {
    vi.stubEnv('MEDIA_EXTRACTOR_PROVIDER', 'mock');
    let last = {
      status: 0,
      json: {} as { error?: { code: string; retryAfterSeconds?: number } },
      headers: new Headers(),
    };
    for (let i = 0; i < 12; i++)
      last = await call(req({ url: url('5550000003') }, { 'x-forwarded-for': '203.0.113.50' }));
    expect(last.status).toBe(429);
    expect(last.json.error?.code).toBe('RATE_LIMITED');
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0);
    const other = await call(
      req({ url: url('5550000003') }, { 'x-forwarded-for': '203.0.113.51' }),
    );
    expect(other.status).toBe(200);
  });
});
