import { NextRequest, NextResponse } from 'next/server';
import { analyzeCandidate } from '@/lib/ai';
import { fetchTickerNews } from '@/lib/news';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidate } = body;
    if (!candidate || !candidate.symbol) {
      return NextResponse.json({ error: 'Candidate data required' }, { status: 400 });
    }
    const news = await fetchTickerNews(candidate.symbol);
    const analysis = await analyzeCandidate(candidate, news);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('[API] POST /api/ai/analyze error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
