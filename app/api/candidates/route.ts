import { NextRequest, NextResponse } from 'next/server';
import { getCandidates } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flag = searchParams.get('flag') || undefined;
    const strategy = searchParams.get('strategy') || undefined;
    const minPop = searchParams.get('min_pop') ? parseFloat(searchParams.get('min_pop')!) : undefined;
    const candidates = getCandidates({ flag, strategy, min_pop: minPop });
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('[API] GET /api/candidates error:', error);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
