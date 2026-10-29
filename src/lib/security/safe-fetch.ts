import dns from 'node:dns';
import { isIP } from 'node:net';
import https from 'node:https';
import { Readable } from 'node:stream';
import { isPrivateOrReservedIp } from './ip';

export class SafeFetchError extends Error {
  constructor(
    public readonly reason:
      | 'BLOCKED_HOST'
      | 'BLOCKED_ADDRESS'
      | 'BLOCKED_PROTOCOL'
      | 'BLOCKED_PORT'
      | 'TOO_MANY_REDIRECTS'
      | 'BAD_REDIRECT'
      | 'TIMEOUT'
      | 'TOO_LARGE'
      | 'NETWORK',
    message?: string,
  ) {
    super(message ?? reason);
    this.name = 'SafeFetchError';
  }
}

export type SafeFetchOptions = {
  /** Decides whether a URL (initial or any redirect target) may be requested. */
  isAllowedUrl: (url: URL) => boolean;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  maxRedirects?: number;
  timeoutMs?: number;
  /** Test seam: replaces DNS resolution. */
  lookup?: (hostname: string) => Promise<string[]>;
  /** Test seam: replaces the HTTP client. */
  fetchImpl?: (
    url: string,
    init: { method: string; headers: Record<string, string>; signal: AbortSignal },
  ) => Promise<Response>;
};

export type SafeFetchResult = {
  response: Response;
  finalUrl: URL;
  redirects: number;
};

async function defaultLookup(hostname: string): Promise<string[]> {
  const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

/**
 * Connection-time DNS guard: even if a hostname resolved to a public address during
 * pre-validation, the address actually connected to is re-checked here, which defeats
 * DNS-rebinding between "check" and "use".
 */
function guardedLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: Error | null, address: string | dns.LookupAddress[], family?: number) => void,
) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    const list = Array.isArray(addresses) ? addresses : [];
    if (list.length === 0 || list.some((a) => isPrivateOrReservedIp(a.address))) {
      return callback(new SafeFetchError('BLOCKED_ADDRESS'), '', 4);
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0]!.address, list[0]!.family);
  });
}

/** Minimal fetch over node:https (no extra dependency, works on Node 20+) using the guarded lookup. */
function guardedFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; signal: AbortSignal },
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: 'https:',
        hostname: u.hostname.replace(/^\[|\]$/g, ''),
        port: 443,
        path: `${u.pathname}${u.search}`,
        method: init.method,
        headers: init.headers,
        signal: init.signal,
        lookup: guardedLookup as unknown as https.RequestOptions['lookup'],
      },
      (res) => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
          else if (v !== undefined) headers.set(k, v);
        }
        const status = res.statusCode ?? 502;
        const noBody = status === 204 || status === 205 || status === 304 || init.method === 'HEAD';
        if (noBody) res.resume();
        resolve(
          new Response(
            noBody ? null : (Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>),
            {
              status,
              headers,
            },
          ),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function assertPublicHost(url: URL, lookup: (h: string) => Promise<string[]>) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isPrivateOrReservedIp(host)) throw new SafeFetchError('BLOCKED_ADDRESS');
    return;
  }
  let addresses: string[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new SafeFetchError('NETWORK', 'DNS resolution failed');
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateOrReservedIp(a))) {
    throw new SafeFetchError('BLOCKED_ADDRESS');
  }
}

function assertUrlShape(url: URL, opts: SafeFetchOptions) {
  if (url.protocol !== 'https:') throw new SafeFetchError('BLOCKED_PROTOCOL');
  if (url.username || url.password) throw new SafeFetchError('BLOCKED_HOST');
  if (url.port && url.port !== '443') throw new SafeFetchError('BLOCKED_PORT');
  if (!opts.isAllowedUrl(url)) throw new SafeFetchError('BLOCKED_HOST');
}

/**
 * Fetch with SSRF controls: protocol/port/host policy, DNS validation, manual redirect
 * handling with every hop re-validated, a redirect cap and an overall timeout.
 * The caller owns the response body and must consume or cancel it.
 */
export async function safeFetch(
  input: string | URL,
  opts: SafeFetchOptions,
): Promise<SafeFetchResult> {
  const maxRedirects = opts.maxRedirects ?? 3;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const lookup = opts.lookup ?? defaultLookup;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let current: URL;
  try {
    current = new URL(input);
  } catch {
    clearTimeout(timer);
    throw new SafeFetchError('BLOCKED_HOST');
  }

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      assertUrlShape(current, opts);
      await assertPublicHost(current, lookup);

      let response: Response;
      try {
        const init = {
          method: opts.method ?? 'GET',
          headers: { 'user-agent': 'ReelSave-link-check/1.0', ...opts.headers },
          signal: controller.signal,
        };
        response = await (opts.fetchImpl ?? guardedFetch)(current.toString(), init);
      } catch (err) {
        if (err instanceof SafeFetchError) throw err;
        if (controller.signal.aborted) throw new SafeFetchError('TIMEOUT');
        const cause = (err as { cause?: unknown })?.cause;
        if (cause instanceof SafeFetchError) throw cause;
        throw new SafeFetchError('NETWORK');
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel().catch(() => undefined);
        if (!location) throw new SafeFetchError('BAD_REDIRECT');
        if (hop === maxRedirects) throw new SafeFetchError('TOO_MANY_REDIRECTS');
        try {
          current = new URL(location, current);
        } catch {
          throw new SafeFetchError('BAD_REDIRECT');
        }
        continue;
      }
      // Timer is cleared by the caller via the returned body lifecycle; keep it running
      // until the body is fully read or cancelled (abort covers slow-body attacks).
      const done = () => clearTimeout(timer);
      if (!response.body) done();
      return { response: attachTimerCleanup(response, done), finalUrl: current, redirects: hop };
    }
    throw new SafeFetchError('TOO_MANY_REDIRECTS');
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function attachTimerCleanup(response: Response, done: () => void): Response {
  const body = response.body;
  if (!body) return response;
  const reader = body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done: finished, value } = await reader.read();
        if (finished) {
          done();
          controller.close();
        } else if (value) controller.enqueue(value);
      } catch (e) {
        done();
        controller.error(e);
      }
    },
    cancel(reason) {
      done();
      return reader.cancel(reason);
    },
  });
  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/** Reads a body with a hard byte cap. */
export async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new SafeFetchError('TOO_LARGE');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Wraps a stream so it errors out once `maxBytes` have been passed through. */
export function limitStream(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  let total = 0;
  const reader = stream.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) return controller.close();
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return controller.error(new SafeFetchError('TOO_LARGE'));
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
