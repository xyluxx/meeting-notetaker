import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness probe. Returns 200 with basic build/runtime info. Used by compose + the landing page. */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'web',
    time: new Date().toISOString(),
  });
}
