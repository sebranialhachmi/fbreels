import { describe, expect, it } from 'vitest';
import { MAX_URL_LENGTH, parseFacebookUrl } from '@/lib/validation/facebook-url';

const ok = (input: string) => {
  const r = parseFacebookUrl(input);
  if (!r.ok) throw new Error(`expected ok for ${input}, got ${r.code}`);
  return r;
};

describe('parseFacebookUrl — accepted shapes', () => {
  it.each([
    [
      'https://www.facebook.com/reel/1234567890123',
      'https://www.facebook.com/reel/1234567890123',
      'reel',
    ],
    [
      'https://facebook.com/reel/1234567890123/',
      'https://www.facebook.com/reel/1234567890123',
      'reel',
    ],
    [
      'https://m.facebook.com/reel/1234567890123?s=yWDuG2&fs=e',
      'https://www.facebook.com/reel/1234567890123',
      'reel',
    ],
    [
      'https://web.facebook.com/reel/1234567890123',
      'https://www.facebook.com/reel/1234567890123',
      'reel',
    ],
    [
      'https://www.facebook.com/watch/?v=1234567890&extra=1',
      'https://www.facebook.com/watch/?v=1234567890',
      'watch',
    ],
    [
      'https://www.facebook.com/video.php?v=1234567890',
      'https://www.facebook.com/video.php?v=1234567890',
      'video',
    ],
    [
      'https://www.facebook.com/somepage/videos/1234567890/',
      'https://www.facebook.com/somepage/videos/1234567890',
      'video',
    ],
    [
      'https://www.facebook.com/somepage/videos/some-title/1234567890',
      'https://www.facebook.com/somepage/videos/1234567890',
      'video',
    ],
    [
      'https://www.facebook.com/share/r/AbCdEf123/',
      'https://www.facebook.com/share/r/AbCdEf123/',
      'share',
    ],
    [
      'https://www.facebook.com/share/v/AbCdEf123/',
      'https://www.facebook.com/share/v/AbCdEf123/',
      'share',
    ],
    [
      'https://www.facebook.com/share/AbCdEf123/',
      'https://www.facebook.com/share/AbCdEf123/',
      'share',
    ],
    ['https://fb.watch/AbCdEf123/', 'https://fb.watch/AbCdEf123/', 'short'],
  ])('%s', (input, normalized, kind) => {
    const r = ok(input);
    expect(r.url).toBe(normalized);
    expect(r.kind).toBe(kind);
  });

  it('upgrades http to https, tolerates scheme-less input, surrounding whitespace and upper-case hosts', () => {
    expect(ok('http://www.facebook.com/reel/1234567890').url).toBe(
      'https://www.facebook.com/reel/1234567890',
    );
    expect(ok('facebook.com/reel/1234567890').url).toBe('https://www.facebook.com/reel/1234567890');
    expect(ok('  https://WWW.FACEBOOK.COM/reel/1234567890  ').url).toBe(
      'https://www.facebook.com/reel/1234567890',
    );
  });

  it('drops tracking parameters and fragments', () => {
    expect(ok('https://www.facebook.com/reel/1234567890?fbclid=abc&mibextid=x#frag').url).toBe(
      'https://www.facebook.com/reel/1234567890',
    );
  });
});

describe('parseFacebookUrl — rejections', () => {
  it.each([
    ['https://evil.com/reel/1234567890', 'UNSUPPORTED_URL'],
    ['https://facebook.com.evil.com/reel/1234567890', 'UNSUPPORTED_URL'],
    ['https://evil.com/facebook.com/reel/1234567890', 'UNSUPPORTED_URL'],
    ['https://notfacebook.com/reel/1234567890', 'UNSUPPORTED_URL'],
    ['https://facebook.com.fb.watch.evil.com/AbCdEf', 'UNSUPPORTED_URL'],
    ['https://fb.watch.evil.com/AbCdEf', 'UNSUPPORTED_URL'],
    ['https://www.facebook.com@evil.com/reel/1234567890', 'INVALID_URL'],
    ['https://user:pw@www.facebook.com/reel/1234567890', 'INVALID_URL'],
    ['https://www.facebook.com:8443/reel/1234567890', 'INVALID_URL'],
    ['https://www.facebооk.com/reel/1234567890', 'UNSUPPORTED_URL'], // Cyrillic homoglyphs
    ['https://127.0.0.1/reel/1234567890', 'UNSUPPORTED_URL'],
    ['https://[::1]/reel/1234567890', 'UNSUPPORTED_URL'],
    ['https://localhost/reel/1234567890', 'UNSUPPORTED_URL'],
    ['https://www.facebook.com/', 'UNSUPPORTED_URL'],
    ['https://www.facebook.com/somepage', 'UNSUPPORTED_URL'],
    ['https://www.facebook.com/photo/?fbid=123456789', 'UNSUPPORTED_URL'],
    ['https://www.facebook.com/reel/not-a-number', 'UNSUPPORTED_URL'],
    ['https://www.facebook.com/watch/?v=abc', 'UNSUPPORTED_URL'],
    ['https://www.facebook.com/a/videos/', 'UNSUPPORTED_URL'],
    ['https://www.facebook.com/reel/1234567890/extra', 'UNSUPPORTED_URL'],
    ['javascript:alert(1)', 'INVALID_URL'],
    ['data:text/html,<script>', 'INVALID_URL'],
    ['file:///etc/passwd', 'INVALID_URL'],
    ['ftp://www.facebook.com/reel/1234567890', 'INVALID_URL'],
    ['https://www.facebook.com/reel/1234567890 https://evil.com', 'INVALID_URL'],
    ['https://www.facebook.com/reel/1234567890\nhttps://evil.com', 'INVALID_URL'],
    ['https://www.facebook.com/reel/1234567890‮', 'INVALID_URL'],
    ['https://www.facebook.com/reel/1234567890​', 'INVALID_URL'],
    ['', 'INVALID_URL'],
    ['   ', 'INVALID_URL'],
    ['not a url', 'INVALID_URL'],
    ['https://', 'INVALID_URL'],
  ])('%j -> %s', (input, code) => {
    const r = parseFacebookUrl(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(code);
  });

  it('rejects non-strings and oversized input', () => {
    expect(parseFacebookUrl(undefined).ok).toBe(false);
    expect(parseFacebookUrl(null).ok).toBe(false);
    expect(parseFacebookUrl(123).ok).toBe(false);
    expect(
      parseFacebookUrl({ toString: () => 'https://www.facebook.com/reel/1234567890' }).ok,
    ).toBe(false);
    const huge = `https://www.facebook.com/reel/1234567890?${'a'.repeat(MAX_URL_LENGTH)}`;
    expect(parseFacebookUrl(huge).ok).toBe(false);
  });
});
