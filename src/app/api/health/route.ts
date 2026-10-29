import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness only. Deliberately exposes no configuration or provider details. */
export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
