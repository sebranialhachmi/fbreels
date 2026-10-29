import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '@/lib/errors';

/**
 * Download tokens are AES-256-GCM encrypted (confidential + tamper-evident) so the
 * client never sees the upstream media URL and cannot forge a destination.
 * Stateless, so it works across serverless instances and restarts.
 */

const payloadSchema = z.object({
  u: z.string().min(1).max(4000), // upstream URL ("mock:<id>" for test provider)
  e: z.number().int(), // expiry, epoch seconds
  f: z.string().min(1).max(120), // safe filename (no path)
  m: z.string().min(1).max(100), // mime type (allowlisted at issue time)
  s: z.number().int().positive().optional(), // declared size
});

export type DownloadTokenPayload = {
  upstreamUrl: string;
  expiresAt: number; // epoch seconds
  filename: string;
  mimeType: string;
  size?: number;
};

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(`reelsave:download-token:v1:${secret}`).digest();
}

export function getTokenSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.DOWNLOAD_TOKEN_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (env.NODE_ENV === 'production') throw new AppError('SERVER_CONFIGURATION_ERROR');
  // Development/test only: ephemeral per-process secret. Never used in production.
  return ((globalThis as { __devTokenSecret?: string }).__devTokenSecret ??=
    randomBytes(32).toString('hex'));
}

export function issueDownloadToken(payload: DownloadTokenPayload, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const body = JSON.stringify({
    u: payload.upstreamUrl,
    e: payload.expiresAt,
    f: payload.filename,
    m: payload.mimeType,
    s: payload.size,
  });
  const enc = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}

/** Throws AppError(TOKEN_EXPIRED) for expired tokens and for anything that fails verification. */
export function openDownloadToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): DownloadTokenPayload {
  if (
    typeof token !== 'string' ||
    token.length < 40 ||
    token.length > 8192 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    throw new AppError('TOKEN_EXPIRED');
  }
  try {
    const raw = Buffer.from(token, 'base64url');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    const parsed = payloadSchema.parse(JSON.parse(json));
    if (parsed.e <= nowSeconds) throw new AppError('TOKEN_EXPIRED');
    return {
      upstreamUrl: parsed.u,
      expiresAt: parsed.e,
      filename: parsed.f,
      mimeType: parsed.m,
      size: parsed.s,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('TOKEN_EXPIRED');
  }
}
