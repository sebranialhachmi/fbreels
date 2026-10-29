/**
 * Strict Facebook URL validation. This is the single source of truth, used by both
 * the browser (for instant feedback) and the server (which never trusts the client).
 */

export const MAX_URL_LENGTH = 2048;

/** Exact hostnames accepted. No wildcard/suffix matching, so look-alikes cannot pass. */
export const ALLOWED_HOSTS = [
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'web.facebook.com',
  'fb.watch',
] as const;

export type FacebookUrlKind = 'reel' | 'video' | 'watch' | 'share' | 'short';

export type ParsedFacebookUrl =
  | { ok: true; url: string; host: string; kind: FacebookUrlKind }
  | { ok: false; code: 'INVALID_URL' | 'UNSUPPORTED_URL' };

/** Rejects whitespace, control characters and invisible/bidi-override code points anywhere in the input. */
function hasForbiddenChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (
      c <= 0x20 ||
      (c >= 0x7f && c <= 0x9f) ||
      (c >= 0x200b && c <= 0x200f) ||
      (c >= 0x2028 && c <= 0x202e) ||
      (c >= 0x2066 && c <= 0x2069) ||
      c === 0xfeff
    ) {
      return true;
    }
  }
  return false;
}

const ID = /^[A-Za-z0-9_-]{3,100}$/;
const NUMERIC_ID = /^\d{5,30}$/;

function isAllowedHost(host: string): boolean {
  return (ALLOWED_HOSTS as readonly string[]).includes(host);
}

function classify(host: string, url: URL): { kind: FacebookUrlKind; path: string } | null {
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'fb.watch') {
    const [code, ...rest] = segments;
    if (code && rest.length === 0 && ID.test(code)) return { kind: 'short', path: `/${code}/` };
    return null;
  }

  const [first, second, third, fourth] = segments;
  if (!first) return null;

  // /reel/<id>
  if (first === 'reel' && second && NUMERIC_ID.test(second) && !third) {
    return { kind: 'reel', path: `/reel/${second}` };
  }
  // /share/r/<code>, /share/v/<code>, /share/<code>
  if (first === 'share') {
    if ((second === 'r' || second === 'v') && third && ID.test(third) && !fourth) {
      return { kind: 'share', path: `/share/${second}/${third}/` };
    }
    if (second && ID.test(second) && !third && second !== 'r' && second !== 'v') {
      return { kind: 'share', path: `/share/${second}/` };
    }
    return null;
  }
  // /watch/?v=<id>
  if (first === 'watch' && !second) {
    const v = url.searchParams.get('v');
    if (v && NUMERIC_ID.test(v)) return { kind: 'watch', path: `/watch/?v=${v}` };
    return null;
  }
  // /video.php?v=<id>
  if (first === 'video.php' && !second) {
    const v = url.searchParams.get('v');
    if (v && NUMERIC_ID.test(v)) return { kind: 'video', path: `/video.php?v=${v}` };
    return null;
  }
  // /<page-or-profile>/videos/<id>  and  /<page>/videos/<slug>/<id>
  if (second === 'videos') {
    const id = fourth && !segments[4] ? fourth : third && !fourth ? third : undefined;
    if (id && NUMERIC_ID.test(id) && /^[A-Za-z0-9.\-_]{1,100}$/.test(first)) {
      return { kind: 'video', path: `/${first}/videos/${id}` };
    }
    return null;
  }
  return null;
}

/**
 * Parse and normalize a user-supplied URL.
 * - Only http(s) (http is upgraded to https), no credentials, no custom ports.
 * - Only exact allowlisted hosts; tracking parameters and fragments are dropped.
 */
export function parseFacebookUrl(input: unknown): ParsedFacebookUrl {
  if (typeof input !== 'string') return { ok: false, code: 'INVALID_URL' };
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return { ok: false, code: 'INVALID_URL' };
  if (hasForbiddenChars(trimmed)) return { ok: false, code: 'INVALID_URL' };

  let url: URL;
  try {
    // Allow "facebook.com/..." without scheme for convenience.
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    url = new URL(withScheme);
  } catch {
    return { ok: false, code: 'INVALID_URL' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, code: 'INVALID_URL' };
  }
  if (url.username || url.password) return { ok: false, code: 'INVALID_URL' };
  if (
    url.port &&
    !(
      (url.protocol === 'https:' && url.port === '443') ||
      (url.protocol === 'http:' && url.port === '80')
    )
  ) {
    return { ok: false, code: 'INVALID_URL' };
  }

  const host = url.hostname.toLowerCase();
  if (!isAllowedHost(host)) return { ok: false, code: 'UNSUPPORTED_URL' };

  const matched = classify(host, url);
  if (!matched) return { ok: false, code: 'UNSUPPORTED_URL' };

  const canonicalHost = host === 'fb.watch' ? 'fb.watch' : 'www.facebook.com';
  return {
    ok: true,
    url: `https://${canonicalHost}${matched.path}`,
    host: canonicalHost,
    kind: matched.kind,
  };
}

/** True if a (post-redirect) URL still points at an allowlisted Facebook host. */
export function isAllowedFacebookHostUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    isAllowedHost(url.hostname.toLowerCase())
  );
}
