import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { getExtractor } from '@/lib/providers';
import { HttpJsonExtractor } from '@/lib/providers/http-json-provider';

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const throwsCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as AppError).code;
  }
  return 'NONE';
};

describe('getExtractor', () => {
  it('has no default provider: missing/none/unknown => SERVER_CONFIGURATION_ERROR', () => {
    expect(throwsCode(() => getExtractor(env({})))).toBe('SERVER_CONFIGURATION_ERROR');
    expect(throwsCode(() => getExtractor(env({ MEDIA_EXTRACTOR_PROVIDER: 'none' })))).toBe(
      'SERVER_CONFIGURATION_ERROR',
    );
    expect(throwsCode(() => getExtractor(env({ MEDIA_EXTRACTOR_PROVIDER: 'whatever' })))).toBe(
      'SERVER_CONFIGURATION_ERROR',
    );
  });

  it('refuses the mock provider in production', () => {
    expect(
      throwsCode(() =>
        getExtractor(env({ MEDIA_EXTRACTOR_PROVIDER: 'mock', NODE_ENV: 'production' })),
      ),
    ).toBe('SERVER_CONFIGURATION_ERROR');
    expect(
      getExtractor(env({ MEDIA_EXTRACTOR_PROVIDER: 'mock', NODE_ENV: 'development' })).id,
    ).toBe('mock');
  });

  it('requires a base URL for http-json and rejects insecure/invalid URLs', () => {
    expect(throwsCode(() => getExtractor(env({ MEDIA_EXTRACTOR_PROVIDER: 'http-json' })))).toBe(
      'SERVER_CONFIGURATION_ERROR',
    );
    expect(
      throwsCode(() =>
        getExtractor(
          env({
            MEDIA_EXTRACTOR_PROVIDER: 'http-json',
            MEDIA_EXTRACTOR_BASE_URL: 'http://api.example.com/x',
          }),
        ),
      ),
    ).toBe('SERVER_CONFIGURATION_ERROR');
    expect(
      throwsCode(() =>
        getExtractor(
          env({ MEDIA_EXTRACTOR_PROVIDER: 'http-json', MEDIA_EXTRACTOR_BASE_URL: 'garbage' }),
        ),
      ),
    ).toBe('SERVER_CONFIGURATION_ERROR');
    expect(
      getExtractor(
        env({
          MEDIA_EXTRACTOR_PROVIDER: 'http-json',
          MEDIA_EXTRACTOR_BASE_URL: 'https://api.example.com/resolve',
        }),
      ).id,
    ).toBe('http-json');
  });
});

describe('HttpJsonExtractor (adapter, tested against a fake endpoint)', () => {
  const make = (fetchImpl: typeof fetch, extra = {}) =>
    new HttpJsonExtractor({
      baseUrl: 'https://api.example.com/resolve',
      apiKey: 'KEY',
      fetchImpl,
      ...extra,
    });
  const ok = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const url = 'https://www.facebook.com/reel/1234567890';

  it('posts only the validated URL with the bearer key and maps a valid response', async () => {
    const f = vi.fn(async () =>
      ok({
        title: 'T',
        thumbnail: 'https://img.example.com/t.jpg',
        duration: 10,
        formats: [
          {
            id: 'hd',
            type: 'video',
            quality: 'HD',
            mimeType: 'video/mp4',
            size: 1000,
            url: 'https://cdn.example.com/a.mp4',
          },
          { id: 'ins', type: 'video', quality: 'SD', url: 'http://cdn.example.com/insecure.mp4' },
        ],
      }),
    );
    const media = await make(f as unknown as typeof fetch).resolve({ url });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ url });
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer KEY');
    expect(init.redirect).toBe('error');
    expect(media.formats).toHaveLength(1); // http:// format dropped
    expect(media.formats[0]!.upstreamUrl).toBe('https://cdn.example.com/a.mp4');
    expect(media.source).toBe('http-json');
  });

  it('does not invent values for missing fields', async () => {
    const f = async () =>
      ok({
        formats: [{ id: 'x', type: 'video', quality: 'SD', url: 'https://cdn.example.com/a.mp4' }],
      });
    const media = await make(f as unknown as typeof fetch).resolve({ url });
    expect(media).toMatchObject({ title: null, thumbnail: null, duration: null });
    expect(media.formats[0]).toMatchObject({ mimeType: null, size: null, expiresAt: null });
  });

  it('maps upstream errors to safe codes', async () => {
    const expectCode = async (res: Response, c: string) =>
      expect(
        make((async () => res) as unknown as typeof fetch).resolve({ url }),
      ).rejects.toMatchObject({ code: c });
    await expectCode(
      ok({ error: { code: 'PRIVATE_OR_INACCESSIBLE_CONTENT' } }, 403),
      'PRIVATE_OR_INACCESSIBLE_CONTENT',
    );
    await expectCode(ok({ error: { code: 'CONTENT_UNAVAILABLE' } }, 404), 'CONTENT_UNAVAILABLE');
    await expectCode(ok({ error: { code: 'NO_SUPPORTED_FORMATS' } }, 422), 'NO_SUPPORTED_FORMATS');
    await expectCode(ok({ error: { code: 'boom' } }, 500), 'PROVIDER_UNAVAILABLE');
    await expectCode(ok({}, 429), 'PROVIDER_UNAVAILABLE');
    await expectCode(ok({ error: { code: 'bad key' } }, 401), 'SERVER_CONFIGURATION_ERROR');
    await expectCode(new Response('<html>oops</html>', { status: 502 }), 'PROVIDER_UNAVAILABLE');
    await expectCode(ok({ unexpected: true }), 'PROVIDER_UNAVAILABLE'); // schema mismatch
  });

  it('maps network failure and timeout', async () => {
    await expect(
      make((async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch).resolve({ url }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_r, rej) =>
        init.signal!.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))),
      )) as unknown as typeof fetch;
    await expect(make(hang, { timeoutMs: 30 }).resolve({ url })).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
    });
  });
});
