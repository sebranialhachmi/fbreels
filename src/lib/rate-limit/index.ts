import { createHash } from 'node:crypto';

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export interface RateLimiter {
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

/**
 * Fixed-window in-memory limiter. IMPORTANT: state is per process. On serverless or
 * multi-instance deployments it only limits per instance; configure the REST store
 * (RATE_LIMIT_REST_URL / RATE_LIMIT_REST_TOKEN) for a shared limit.
 */
export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private now: () => number = Date.now,
    private maxKeys = 10_000,
  ) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = this.now();
    if (this.buckets.size > this.maxKeys) this.sweep(now);
    let b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowSeconds * 1000 };
      this.buckets.set(key, b);
    }
    b.count += 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return {
      allowed: b.count <= limit,
      remaining: Math.max(0, limit - b.count),
      retryAfterSeconds,
    };
  }

  private sweep(now: number) {
    for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
    // Hard cap against key-flooding.
    if (this.buckets.size > this.maxKeys) this.buckets.clear();
  }
}

/**
 * Upstash-compatible Redis REST limiter (INCR + EXPIRE via /pipeline). Shared across
 * instances. Falls back to the memory limiter if the store is unreachable (fail-open
 * for availability, logged by the caller). NOT verified against a live store in this repo.
 */
export class RestRateLimiter implements RateLimiter {
  constructor(
    private baseUrl: string,
    private token: string,
    private fallback: RateLimiter = new MemoryRateLimiter(),
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
    const redisKey = `rl:${key}:${bucket}`;
    try {
      const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['EXPIRE', redisKey, String(windowSeconds), 'NX'],
        ]),
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as Array<{ result?: number }>;
      const count = Number(data[0]?.result);
      if (!Number.isFinite(count)) throw new Error('bad response');
      const elapsed = Math.floor(Date.now() / 1000) % windowSeconds;
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterSeconds: Math.max(1, windowSeconds - elapsed),
      };
    } catch {
      return this.fallback.hit(key, limit, windowSeconds);
    }
  }
}

let singleton: RateLimiter | undefined;

export function getRateLimiter(env: NodeJS.ProcessEnv = process.env): RateLimiter {
  if (singleton) return singleton;
  const url = env.RATE_LIMIT_REST_URL?.trim();
  const token = env.RATE_LIMIT_REST_TOKEN?.trim();
  singleton =
    url && token && /^https:\/\//.test(url)
      ? new RestRateLimiter(url, token)
      : new MemoryRateLimiter();
  return singleton;
}

export function resetRateLimiterForTests(limiter?: RateLimiter) {
  singleton = limiter;
}

/** Client identifier: hashed so raw IPs are never stored in keys or external stores. */
export function clientKey(
  headers: Headers,
  scope: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  let ip = 'unknown';
  if (env.TRUST_PROXY_HEADERS !== 'false') {
    const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    ip = xff || headers.get('x-real-ip')?.trim() || 'unknown';
  }
  return `${scope}:${createHash('sha256').update(ip).digest('hex').slice(0, 24)}`;
}
