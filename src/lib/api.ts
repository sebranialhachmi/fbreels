import { NextResponse } from 'next/server';
import { AppError, HTTP_STATUS, type ErrorCode } from '@/lib/errors';
import { clientKey, getRateLimiter } from '@/lib/rate-limit';

export function errorResponse(code: ErrorCode, retryAfterSeconds?: number, status?: number) {
  const res = NextResponse.json(
    {
      success: false as const,
      error: { code, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) },
    },
    { status: status ?? HTTP_STATUS[code] },
  );
  res.headers.set('Cache-Control', 'no-store');
  if (retryAfterSeconds) res.headers.set('Retry-After', String(retryAfterSeconds));
  return res;
}

export function toErrorResponse(err: unknown) {
  if (err instanceof AppError) return errorResponse(err.code, err.retryAfterSeconds);
  return errorResponse('INTERNAL_ERROR'); // never leak internals
}

/** Browser-sent cross-site POSTs always carry Origin; reject when it does not match this host. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser client (curl, server-to-server): no ambient credentials to abuse
  try {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    return !!host && new URL(origin).host === host.split(',')[0]!.trim();
  } catch {
    return false;
  }
}

/** Reads a JSON body with a hard size cap. Throws AppError(INVALID_URL)-style codes on abuse. */
export async function readJsonBody(req: Request, maxBytes = 8 * 1024): Promise<unknown> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) throw new AppError('INVALID_URL');
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new AppError('INVALID_URL');
  const text = await req.text();
  if (text.length > maxBytes) throw new AppError('INVALID_URL');
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('INVALID_URL');
  }
}

export async function enforceRateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  const result = await getRateLimiter().hit(clientKey(req.headers, scope), limit, windowSeconds);
  if (!result.allowed) throw new AppError('RATE_LIMITED', result.retryAfterSeconds);
}
