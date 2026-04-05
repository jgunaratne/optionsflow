import { NextResponse } from 'next/server';
import { runScreener, isScreenerRunning } from '@/lib/screener';

export async function POST() {
  try {
    if (isScreenerRunning()) {
      return NextResponse.json({ error: 'Screener is already running' }, { status: 409 });
    }
    runScreener().catch(err => console.error('[API] Background screener error:', err));
    return NextResponse.json({ started: true });
  } catch (error) {
    console.error('[API] POST /api/screener/run error:', error);
    return NextResponse.json({ error: 'Failed to start screener' }, { status: 500 });
  }
}
