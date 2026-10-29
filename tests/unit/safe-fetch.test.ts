import { describe, expect, it, vi } from 'vitest';
import { SafeFetchError, limitStream, readLimited, safeFetch } from '@/lib/security/safe-fetch';
import { isAllowedFacebookHostUrl } from '@/lib/validation/facebook-url';

const publicLookup = async () => ['157.240.1.35'];
const fbOnly = isAllowedFacebookHostUrl;

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}

async function reason(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof SafeFetchError) return e.reason;
    throw e;
  }
  return 'NO_ERROR';
}

describe('safeFetch — SSRF controls', () => {
  it('fetches an allowed https URL', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok'));
    const { response, finalUrl, redirects } = await safeFetch('https://www.facebook.com/reel/1', {
      isAllowedUrl: fbOnly,
      lookup: publicLookup,
      fetchImpl,
    });
    expect(await response.text()).toBe('ok');
    expect(finalUrl.hostname).toBe('www.facebook.com');
    expect(redirects).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects http, credentials, custom ports and non-allowlisted hosts before any request', async () => {
    const fetchImpl = vi.fn(async () => new Response('x'));
    const opts = { isAllowedUrl: fbOnly, lookup: publicLookup, fetchImpl };
    expect(await reason(safeFetch('http://www.facebook.com/x', opts))).toBe('BLOCKED_PROTOCOL');
    expect(await reason(safeFetch('https://u:p@www.facebook.com/x', opts))).toBe('BLOCKED_HOST');
    expect(await reason(safeFetch('https://www.facebook.com:8443/x', opts))).toBe('BLOCKED_PORT');
    expect(await reason(safeFetch('https://evil.com/x', opts))).toBe('BLOCKED_HOST');
    expect(await reason(safeFetch('not a url', opts))).toBe('BLOCKED_HOST');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks hosts that resolve to private/loopback/link-local addresses (DNS check)', async () => {
    const fetchImpl = vi.fn(async () => new Response('x'));
    for (const addr of ['127.0.0.1', '10.0.0.5', '169.254.169.254', '::1', 'fd00::1']) {
      const r = await reason(
        safeFetch('https://www.facebook.com/x', {
          isAllowedUrl: fbOnly,
          lookup: async () => [addr],
          fetchImpl,
        }),
      );
      expect(r).toBe('BLOCKED_ADDRESS');
    }
    // A single bad record among good ones is enough to block (multi-record rebinding trick).
    expect(
      await reason(
        safeFetch('https://www.facebook.com/x', {
          isAllowedUrl: fbOnly,
          lookup: async () => ['157.240.1.35', '127.0.0.1'],
          fetchImpl,
        }),
      ),
    ).toBe('BLOCKED_ADDRESS');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks IP-literal hosts directly', async () => {
    const fetchImpl = vi.fn(async () => new Response('x'));
    const r = await reason(
      safeFetch('https://127.0.0.1/x', {
        isAllowedUrl: () => true,
        lookup: publicLookup,
        fetchImpl,
      }),
    );
    expect(r).toBe('BLOCKED_ADDRESS');
    expect(
      await reason(
        safeFetch('https://[::1]/x', { isAllowedUrl: () => true, lookup: publicLookup, fetchImpl }),
      ),
    ).toBe('BLOCKED_ADDRESS');
  });

  it('follows allowed redirects and revalidates every hop', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      return url.endsWith('/start') ? redirect('/reel/9999999') : new Response('final');
    });
    const { finalUrl, redirects } = await safeFetch('https://fb.watch/start', {
      isAllowedUrl: fbOnly,
      lookup: publicLookup,
      fetchImpl,
    });
    expect(redirects).toBe(1);
    expect(finalUrl.toString()).toBe('https://fb.watch/reel/9999999');
    expect(calls).toHaveLength(2);
  });

  it('blocks a redirect to a non-allowlisted host', async () => {
    const fetchImpl = vi.fn(async () => redirect('https://evil.com/steal'));
    expect(
      await reason(
        safeFetch('https://fb.watch/a', { isAllowedUrl: fbOnly, lookup: publicLookup, fetchImpl }),
      ),
    ).toBe('BLOCKED_HOST');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('blocks a redirect to a downgraded protocol, internal IP or metadata endpoint', async () => {
    for (const target of [
      'http://www.facebook.com/x',
      'https://169.254.169.254/latest/meta-data',
      'https://127.0.0.1/admin',
      'file:///etc/passwd',
    ]) {
      const fetchImpl = vi.fn(async () => redirect(target));
      const r = await reason(
        safeFetch('https://www.facebook.com/a', {
          isAllowedUrl: fbOnly,
          lookup: publicLookup,
          fetchImpl,
        }),
      );
      expect(['BLOCKED_PROTOCOL', 'BLOCKED_HOST', 'BLOCKED_ADDRESS']).toContain(r);
    }
  });

  it('blocks a redirect whose hostname re-resolves to a private address (rebinding between hops)', async () => {
    const lookup = vi.fn(async (h: string) => (h === 'fb.watch' ? ['157.240.1.35'] : ['10.0.0.9']));
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('fb.watch') ? redirect('https://www.facebook.com/x') : new Response('x'),
    );
    expect(
      await reason(safeFetch('https://fb.watch/a', { isAllowedUrl: fbOnly, lookup, fetchImpl })),
    ).toBe('BLOCKED_ADDRESS');
  });

  it('enforces the redirect limit and rejects malformed redirects', async () => {
    const loop = vi.fn(async () => redirect('/again'));
    expect(
      await reason(
        safeFetch('https://fb.watch/a', {
          isAllowedUrl: fbOnly,
          lookup: publicLookup,
          fetchImpl: loop,
          maxRedirects: 3,
        }),
      ),
    ).toBe('TOO_MANY_REDIRECTS');
    expect(loop).toHaveBeenCalledTimes(4);
    const noLocation = vi.fn(async () => new Response(null, { status: 302 }));
    expect(
      await reason(
        safeFetch('https://fb.watch/a', {
          isAllowedUrl: fbOnly,
          lookup: publicLookup,
          fetchImpl: noLocation,
        }),
      ),
    ).toBe('BAD_REDIRECT');
  });

  it('times out slow upstreams', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise<Response>((_res, rej) =>
          init.signal.addEventListener('abort', () =>
            rej(new DOMException('aborted', 'AbortError')),
          ),
        ),
    );
    expect(
      await reason(
        safeFetch('https://fb.watch/a', {
          isAllowedUrl: fbOnly,
          lookup: publicLookup,
          fetchImpl,
          timeoutMs: 30,
        }),
      ),
    ).toBe('TIMEOUT');
  });

  it('maps DNS failures and network errors without leaking details', async () => {
    expect(
      await reason(
        safeFetch('https://fb.watch/a', {
          isAllowedUrl: fbOnly,
          lookup: async () => {
            throw new Error('ENOTFOUND');
          },
        }),
      ),
    ).toBe('NETWORK');
    expect(
      await reason(
        safeFetch('https://fb.watch/a', {
          isAllowedUrl: fbOnly,
          lookup: publicLookup,
          fetchImpl: async () => {
            throw new Error('ECONNRESET');
          },
        }),
      ),
    ).toBe('NETWORK');
  });
});

describe('response size limits', () => {
  const stream = (chunks: number[]) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const n of chunks) c.enqueue(new Uint8Array(n));
        c.close();
      },
    });

  it('readLimited returns small bodies and aborts oversized ones', async () => {
    expect((await readLimited(new Response(stream([10, 10])), 100)).byteLength).toBe(20);
    expect(await reason(readLimited(new Response(stream([60, 60])), 100))).toBe('TOO_LARGE');
  });

  it('limitStream errors once the cap is passed', async () => {
    const ok = limitStream(stream([40, 40]), 100);
    expect((await readLimited(new Response(ok), 1000)).byteLength).toBe(80);
    const tooBig = limitStream(stream([60, 60]), 100);
    await expect(readLimited(new Response(tooBig), 1000)).rejects.toBeInstanceOf(SafeFetchError);
  });
});

describe('safeFetch — connect-time DNS guard (rebinding defence)', () => {
  it('refuses to connect when the real resolution is loopback even if pre-validation saw a public address', async () => {
    // Pre-check is fooled (returns a public IP); the connection-time lookup of "localhost" resolves to loopback.
    const r = await reason(
      safeFetch('https://localhost/', {
        isAllowedUrl: () => true,
        lookup: async () => ['8.8.8.8'],
        timeoutMs: 3000,
      }),
    );
    expect(r).toBe('BLOCKED_ADDRESS');
  });
});
