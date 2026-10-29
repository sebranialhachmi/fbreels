import { describe, expect, it, vi } from 'vitest';
import { MemoryRateLimiter, RestRateLimiter, clientKey } from '@/lib/rate-limit';

describe('MemoryRateLimiter', () => {
  it('allows up to the limit then blocks, with a retry-after', async () => {
    const t = 0;
    const rl = new MemoryRateLimiter(() => t);
    for (let i = 0; i < 3; i++) expect((await rl.hit('k', 3, 60)).allowed).toBe(true);
    const blocked = await rl.hit('k', 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('isolates keys and resets after the window', async () => {
    let t = 0;
    const rl = new MemoryRateLimiter(() => t);
    await rl.hit('a', 1, 10);
    expect((await rl.hit('a', 1, 10)).allowed).toBe(false);
    expect((await rl.hit('b', 1, 10)).allowed).toBe(true);
    t = 10_001;
    expect((await rl.hit('a', 1, 10)).allowed).toBe(true);
  });

  it('bounds memory under key flooding', async () => {
    const rl = new MemoryRateLimiter(() => 0, 50);
    for (let i = 0; i < 500; i++) await rl.hit(`k${i}`, 1, 60);
    // @ts-expect-error private inspection in test
    expect(rl.buckets.size).toBeLessThanOrEqual(51);
  });
});

describe('RestRateLimiter', () => {
  it('counts through the REST pipeline and enforces the limit', async () => {
    let n = 0;
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify([{ result: ++n }, { result: 1 }])),
    );
    const rl = new RestRateLimiter(
      'https://redis.example.com',
      'tok',
      undefined,
      fetchImpl as unknown as typeof fetch,
    );
    expect((await rl.hit('k', 2, 60)).allowed).toBe(true);
    expect((await rl.hit('k', 2, 60)).allowed).toBe(true);
    expect((await rl.hit('k', 2, 60)).allowed).toBe(false);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('https://redis.example.com/pipeline');
    expect((call[1].headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('falls back to the in-memory limiter when the store is down (fail open, still limited per instance)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('down');
    });
    const rl = new RestRateLimiter(
      'https://redis.example.com',
      'tok',
      new MemoryRateLimiter(),
      fetchImpl as unknown as typeof fetch,
    );
    expect((await rl.hit('k', 1, 60)).allowed).toBe(true);
    expect((await rl.hit('k', 1, 60)).allowed).toBe(false);
  });
});

describe('clientKey', () => {
  it('hashes the first forwarded IP and never contains the raw address', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' });
    const k = clientKey(h, 'extract', {} as NodeJS.ProcessEnv);
    expect(k.startsWith('extract:')).toBe(true);
    expect(k).not.toContain('203.0.113.7');
    expect(
      clientKey(
        new Headers({ 'x-forwarded-for': '203.0.113.7' }),
        'extract',
        {} as NodeJS.ProcessEnv,
      ),
    ).toBe(k);
    expect(
      clientKey(
        new Headers({ 'x-forwarded-for': '203.0.113.8' }),
        'extract',
        {} as NodeJS.ProcessEnv,
      ),
    ).not.toBe(k);
  });

  it('ignores spoofable headers when TRUST_PROXY_HEADERS=false', () => {
    const env = { TRUST_PROXY_HEADERS: 'false' } as unknown as NodeJS.ProcessEnv;
    const a = clientKey(new Headers({ 'x-forwarded-for': '1.1.1.1' }), 's', env);
    const b = clientKey(new Headers({ 'x-forwarded-for': '2.2.2.2' }), 's', env);
    expect(a).toBe(b);
  });
});
