import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import {
  enforceRateLimit,
  errorResponse,
  isSameOrigin,
  readJsonBody,
  toErrorResponse,
} from '@/lib/api';
import { MIN_FILL_MS, contactSchema, deliverContactMessage, getContactConfig } from '@/lib/contact';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) return errorResponse('INTERNAL_ERROR', undefined, 403);
    await enforceRateLimit(req, 'contact', 5, 3600);
    const raw = await readJsonBody(req, 16 * 1024);
    const parsed = contactSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            fields: parsed.error.issues
              .map((i) => String(i.path[0]))
              .filter((v, i, a) => a.indexOf(v) === i),
          },
        },
        { status: 422 },
      );
    }
    const input = parsed.data;
    // Spam traps answer "success" so bots get no signal; nothing is sent.
    const tooFast = input.startedAt !== undefined && Date.now() - input.startedAt < MIN_FILL_MS;
    if (input.website !== '' || tooFast) {
      log('info', 'contact_spam_trap');
      return NextResponse.json({ success: true });
    }
    const cfg = getContactConfig();
    if (!cfg) throw new AppError('SERVER_CONFIGURATION_ERROR');
    const ok = await deliverContactMessage(cfg, input);
    if (!ok) throw new AppError('PROVIDER_UNAVAILABLE');
    log('info', 'contact_sent', { type: input.type });
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
