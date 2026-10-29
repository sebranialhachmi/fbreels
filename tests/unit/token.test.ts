import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { getTokenSecret, issueDownloadToken, openDownloadToken } from '@/lib/security/token';

const SECRET = 'a'.repeat(40);
const now = 1_800_000_000;
const payload = {
  upstreamUrl: 'https://cdn.example.com/v.mp4',
  expiresAt: now + 600,
  filename: 'clip-HD.mp4',
  mimeType: 'video/mp4',
  size: 1234,
};

function code(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : 'OTHER';
  }
  return 'NONE';
}

describe('download tokens', () => {
  it('round-trips', () => {
    const t = issueDownloadToken(payload, SECRET);
    expect(openDownloadToken(t, SECRET, now)).toEqual(payload);
  });

  it('does not expose the upstream URL or filename in the token text', () => {
    const t = issueDownloadToken(payload, SECRET);
    expect(t).not.toContain('example');
    expect(Buffer.from(t, 'base64url').toString('latin1')).not.toContain('cdn.example.com');
  });

  it('expires', () => {
    const t = issueDownloadToken(payload, SECRET);
    expect(code(() => openDownloadToken(t, SECRET, now + 601))).toBe('TOKEN_EXPIRED');
    expect(code(() => openDownloadToken(t, SECRET, now + 600))).toBe('TOKEN_EXPIRED');
    expect(code(() => openDownloadToken(t, SECRET, now + 599))).toBe('NONE');
  });

  it('rejects tampering, wrong secret, truncation and junk with the same safe code', () => {
    const t = issueDownloadToken(payload, SECRET);
    const flipped = t.slice(0, -2) + (t.endsWith('A') ? 'B' : 'A') + t.slice(-1);
    expect(code(() => openDownloadToken(flipped, SECRET, now))).toBe('TOKEN_EXPIRED');
    expect(code(() => openDownloadToken(t, 'b'.repeat(40), now))).toBe('TOKEN_EXPIRED');
    expect(code(() => openDownloadToken(t.slice(0, 30), SECRET, now))).toBe('TOKEN_EXPIRED');
    expect(code(() => openDownloadToken('', SECRET, now))).toBe('TOKEN_EXPIRED');
    expect(code(() => openDownloadToken('../../etc/passwd'.padEnd(60, 'x'), SECRET, now))).toBe(
      'TOKEN_EXPIRED',
    );
    expect(code(() => openDownloadToken('x'.repeat(9000), SECRET, now))).toBe('TOKEN_EXPIRED');
  });

  it('uses a fresh IV each time', () => {
    expect(issueDownloadToken(payload, SECRET)).not.toBe(issueDownloadToken(payload, SECRET));
  });

  it('requires a strong secret in production but not in test/dev', () => {
    expect(code(() => getTokenSecret({ NODE_ENV: 'production' } as NodeJS.ProcessEnv))).toBe(
      'SERVER_CONFIGURATION_ERROR',
    );
    expect(
      code(() =>
        getTokenSecret({
          NODE_ENV: 'production',
          DOWNLOAD_TOKEN_SECRET: 'short',
        } as NodeJS.ProcessEnv),
      ),
    ).toBe('SERVER_CONFIGURATION_ERROR');
    expect(
      getTokenSecret({
        NODE_ENV: 'production',
        DOWNLOAD_TOKEN_SECRET: SECRET,
      } as NodeJS.ProcessEnv),
    ).toBe(SECRET);
    expect(
      getTokenSecret({ NODE_ENV: 'development' } as NodeJS.ProcessEnv).length,
    ).toBeGreaterThanOrEqual(32);
    vi.restoreAllMocks();
  });
});
