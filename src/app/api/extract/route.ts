import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import {
  enforceRateLimit,
  errorResponse,
  isSameOrigin,
  readJsonBody,
  toErrorResponse,
} from '@/lib/api';
import { getExtractService } from '@/lib/extract-service';
import { extractRequestSchema } from '@/types/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const LIMIT = Number(process.env.EXTRACT_RATE_LIMIT) || 10;
const WINDOW = Number(process.env.EXTRACT_RATE_WINDOW_SECONDS) || 60;

export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) return errorResponse('INTERNAL_ERROR', undefined, 403);
    await enforceRateLimit(req, 'extract', LIMIT, WINDOW);
    const body = extractRequestSchema.safeParse(await readJsonBody(req));
    if (!body.success) throw new AppError('INVALID_URL');
    const media = await getExtractService().extract(body.data.url);
    const res = NextResponse.json({ success: true as const, media });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}
