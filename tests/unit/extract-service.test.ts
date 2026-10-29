import { describe, expect, it, vi } from 'vitest';
import { AppError, type ErrorCode } from '@/lib/errors';
import { ExtractService, TOKEN_TTL_SECONDS } from '@/lib/extract-service';
import { MockExtractor } from '@/lib/providers/mock-provider';
import type { MediaExtractor } from '@/lib/providers/media-extractor';
import { openDownloadToken } from '@/lib/security/token';
import type { ProviderMedia } from '@/types/media';

const SECRET = 's'.repeat(40);
const reel = (id: string) => `https://www.facebook.com/reel/${id}`;
const svc = (
  extractor: MediaExtractor,
  extra: ConstructorParameters<typeof ExtractService>[0] = {},
) => new ExtractService({ getExtractor: () => extractor, tokenSecret: () => SECRET, ...extra });

async function code(p: Promise<unknown>): Promise<ErrorCode | 'NONE'> {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
  return 'NONE';
}

type FakeExtractor = MediaExtractor & { resolve: ReturnType<typeof vi.fn<MediaExtractor['resolve']>> };

const fake = (
  media: Partial<ProviderMedia> | (() => Promise<ProviderMedia>),
  over: Partial<Omit<MediaExtractor, 'resolve'>> = {},
): FakeExtractor => {
  const resolve = vi.fn<MediaExtractor['resolve']>(
    typeof media === 'function'
      ? media
      : async () => ({
          title: 't',
          thumbnail: null,
          duration: null,
          source: 'fake',
          formats: [],
          ...media,
        }),
  );
  return { id: 'fake', requiresExpandedUrl: false, ...over, resolve };
};

const fmt = (over = {}) => ({
  id: 'hd',
  type: 'video' as const,
  quality: 'HD',
  mimeType: 'video/mp4',
  size: 5000,
  upstreamUrl: 'https://cdn.example.com/v.mp4',
  expiresAt: null,
  ...over,
});

describe('ExtractService — validation first', () => {
  it('rejects bad input before touching the provider', async () => {
    const provider = fake({ formats: [fmt()] });
    const s = svc(provider);
    expect(await code(s.extract('https://evil.com/reel/1234567'))).toBe('UNSUPPORTED_URL');
    expect(await code(s.extract('not a url'))).toBe('INVALID_URL');
    expect(await code(s.extract(undefined))).toBe('INVALID_URL');
    expect(provider.resolve).not.toHaveBeenCalled();
  });

  it('surfaces missing provider configuration as SERVER_CONFIGURATION_ERROR', async () => {
    const s = new ExtractService({
      getExtractor: () => {
        throw new AppError('SERVER_CONFIGURATION_ERROR');
      },
      tokenSecret: () => SECRET,
    });
    expect(await code(s.extract(reel('1234567890')))).toBe('SERVER_CONFIGURATION_ERROR');
  });
});

describe('ExtractService — results are verified and never fabricated', () => {
  it('returns only the formats the provider reported, with opaque tokens (no upstream URL)', async () => {
    const s = svc(
      fake({
        title: 'Hello',
        duration: 12,
        formats: [fmt(), fmt({ id: 'sd', quality: 'SD', size: null, mimeType: null })],
      }),
    );
    const media = await s.extract(reel('1234567890'));
    expect(media.title).toBe('Hello');
    expect(media.formats.map((f) => f.id)).toEqual(['hd', 'sd']);
    expect(media.formats[1]!.size).toBeNull();
    expect(media.formats[1]!.mimeType).toBeNull(); // unknown stays unknown
    expect(JSON.stringify(media)).not.toContain('cdn.example.com');
    const payload = openDownloadToken(media.formats[0]!.downloadToken, SECRET);
    expect(payload.upstreamUrl).toBe('https://cdn.example.com/v.mp4');
    expect(payload.filename).toMatch(/^[A-Za-z0-9._-]+\.mp4$/);
  });

  it('returns NO_SUPPORTED_FORMATS when nothing usable is left (empty, http-only, unknown MIME, duplicates)', async () => {
    expect(await code(svc(fake({ formats: [] })).extract(reel('1234567891')))).toBe(
      'NO_SUPPORTED_FORMATS',
    );
    expect(
      await code(
        svc(fake({ formats: [fmt({ upstreamUrl: 'http://cdn.example.com/v.mp4' })] })).extract(
          reel('1234567892'),
        ),
      ),
    ).toBe('NO_SUPPORTED_FORMATS');
    expect(
      await code(
        svc(fake({ formats: [fmt({ mimeType: 'application/x-msdownload' })] })).extract(
          reel('1234567893'),
        ),
      ),
    ).toBe('NO_SUPPORTED_FORMATS');
    const dup = await svc(fake({ formats: [fmt(), fmt()] })).extract(reel('1234567894'));
    expect(dup.formats).toHaveLength(1);
  });

  it('caps token lifetime and honours earlier provider expiry', async () => {
    const now = Date.now();
    const s = svc(
      fake({
        formats: [
          fmt({ expiresAt: new Date(now + 60 * 60_000) }),
          fmt({ id: 'soon', expiresAt: new Date(now + 120_000) }),
        ],
      }),
    );
    const media = await s.extract(reel('1234567895'));
    const [long, soon] = media.formats;
    expect(Date.parse(long!.expiresAt!) - now).toBeLessThanOrEqual(TOKEN_TTL_SECONDS * 1000 + 1000);
    expect(Date.parse(soon!.expiresAt!) - now).toBeLessThanOrEqual(121_000);
  });

  it('drops formats that are already expired', async () => {
    const s = svc(fake({ formats: [fmt({ expiresAt: new Date(Date.now() - 1000) })] }));
    expect(await code(s.extract(reel('1234567896')))).toBe('NO_SUPPORTED_FORMATS');
  });

  it('never hides an audio option behind a video one, and keeps types straight', async () => {
    const s = svc(
      fake({
        formats: [fmt(), fmt({ id: 'a', type: 'audio', quality: 'Audio', mimeType: 'audio/mp4' })],
      }),
    );
    const media = await s.extract(reel('1234567897'));
    expect(media.formats.map((f) => f.type)).toEqual(['video', 'audio']);
  });
});

describe('ExtractService — provider failures', () => {
  it.each<ErrorCode>([
    'PRIVATE_OR_INACCESSIBLE_CONTENT',
    'CONTENT_UNAVAILABLE',
    'PROVIDER_UNAVAILABLE',
    'REQUEST_TIMEOUT',
  ])('passes through %s', async (c) => {
    const s = svc(
      fake(async () => {
        throw new AppError(c);
      }),
    );
    expect(await code(s.extract(reel(`12345${c.length}`)))).toBe(c);
  });

  it('hides unexpected exceptions behind INTERNAL_ERROR', async () => {
    const s = svc(
      fake(async () => {
        throw new Error('secret stack /etc/passwd');
      }),
    );
    expect(await code(s.extract(reel('1234567898')))).toBe('INTERNAL_ERROR');
  });

  it('times out slow providers', async () => {
    const s = svc(
      fake(() => new Promise<ProviderMedia>(() => undefined)),
      { timeoutMs: 40 },
    );
    expect(await code(s.extract(reel('1234567899')))).toBe('REQUEST_TIMEOUT');
  });

  it('applies the concurrency limit (excess queued work is bounded)', async () => {
    let active = 0;
    let peak = 0;
    const provider = fake(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 15));
      active--;
      return { title: null, thumbnail: null, duration: null, source: 'fake', formats: [fmt()] };
    });
    const s = svc(provider, { maxConcurrent: 2 });
    await Promise.all(Array.from({ length: 6 }, (_, i) => s.extract(reel(`2000000${i}0`))));
    expect(peak).toBe(2);
  });
});

describe('ExtractService — caching and de-duplication', () => {
  it('serves repeated requests from a short-lived cache and collapses concurrent duplicates', async () => {
    const provider = fake({ formats: [fmt()] });
    const s = svc(provider);
    const [a, b] = await Promise.all([
      s.extract(reel('3000000001')),
      s.extract(reel('3000000001?utm=1')),
    ]);
    expect(provider.resolve).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    await s.extract(reel('3000000001'));
    expect(provider.resolve).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures', async () => {
    let n = 0;
    const provider = fake(async () => {
      if (n++ === 0) throw new AppError('PROVIDER_UNAVAILABLE');
      return { title: null, thumbnail: null, duration: null, source: 'fake', formats: [fmt()] };
    });
    const s = svc(provider);
    expect(await code(s.extract(reel('3000000002')))).toBe('PROVIDER_UNAVAILABLE');
    expect(await code(s.extract(reel('3000000002')))).toBe('NONE');
  });
});

describe('ExtractService — short links', () => {
  it('expands only when the provider requires it, with the guarded expander', async () => {
    const provider = fake({ formats: [fmt()] }, { requiresExpandedUrl: true });
    const expandUrl = vi.fn(async () => reel('4000000001'));
    const s = svc(provider, { expandUrl });
    await s.extract('https://fb.watch/AbCdEf123/');
    expect(expandUrl).toHaveBeenCalledWith('https://fb.watch/AbCdEf123/');
    expect(provider.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ url: reel('4000000001') }),
    );

    const plain = fake({ formats: [fmt()] });
    const expandUrl2 = vi.fn(async () => reel('4000000002'));
    await svc(plain, { expandUrl: expandUrl2 }).extract('https://fb.watch/ZzZzZz123/');
    expect(expandUrl2).not.toHaveBeenCalled();
  });

  it('fails closed when expansion is blocked', async () => {
    const provider = fake({ formats: [fmt()] }, { requiresExpandedUrl: true });
    const s = svc(provider, {
      expandUrl: async () => {
        throw new AppError('UNSUPPORTED_URL');
      },
    });
    expect(await code(s.extract('https://fb.watch/BlockMe123/'))).toBe('UNSUPPORTED_URL');
    expect(provider.resolve).not.toHaveBeenCalled();
  });
});

describe('MockExtractor (test-only)', () => {
  it('is clearly labelled and deterministic', async () => {
    const m = new MockExtractor();
    const media = await m.resolve({ url: reel('1234567890') });
    expect(media.source).toBe('mock');
    expect(media.title).toContain('Test-only');
    expect(media.formats[0]!.upstreamUrl.startsWith('mock:')).toBe(true);
    const full = await m.resolve({ url: reel('9990006') });
    expect(full.formats.map((f) => f.id)).toEqual(['hd', 'sd', 'audio']);
    await expect(m.resolve({ url: reel('9990001') })).rejects.toMatchObject({
      code: 'PRIVATE_OR_INACCESSIBLE_CONTENT',
    });
    await expect(m.resolve({ url: reel('9990002') })).rejects.toMatchObject({
      code: 'CONTENT_UNAVAILABLE',
    });
    await expect(m.resolve({ url: reel('9990003') })).rejects.toMatchObject({
      code: 'NO_SUPPORTED_FORMATS',
    });
    await expect(m.resolve({ url: reel('9990004') })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    await expect(m.resolve({ url: reel('9990005') })).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
    });
  });
});
