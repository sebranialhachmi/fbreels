import { createHash } from 'node:crypto';

/**
 * Minimal structured logger. It never logs full URLs, query strings, cookies or raw IPs:
 * submitted links are reduced to host + a short hash so repeated failures can be correlated
 * without retaining what users pasted.
 */
type Fields = Record<string, string | number | boolean | null | undefined>;

export function hashShort(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}#${hashShort(u.pathname)}`;
  } catch {
    return 'invalid';
  }
}

export function log(level: 'info' | 'warn' | 'error', event: string, fields: Fields = {}) {
  if (process.env.NODE_ENV === 'test') return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
