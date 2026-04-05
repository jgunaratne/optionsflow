import { NextResponse } from 'next/server';
import { getScreenerUniverseSummary } from '@/lib/screener-universe';

export async function GET() {
  try {
    const universe = await getScreenerUniverseSummary();
    return NextResponse.json({ universe });
  } catch (error) {
    console.error('[API] GET /api/screener/universe error:', error);
    return NextResponse.json({ error: 'Failed to fetch screener universe' }, { status: 500 });
  }
}
