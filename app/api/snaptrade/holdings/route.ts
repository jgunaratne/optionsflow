import { NextResponse } from 'next/server';
import { getSnapTradeHoldings, isSnapTradeConfigured } from '@/lib/snaptrade';

/**
 * GET /api/snaptrade/holdings
 * Fetch SnapTrade (Schwab) positions and balances.
 */
export async function GET() {
  try {
    if (!isSnapTradeConfigured()) {
      return NextResponse.json({ configured: false, positions: [], balances: null });
    }

    const details = await getSnapTradeHoldings();
    if (!details) {
      return NextResponse.json({ configured: true, connected: false, positions: [], balances: null });
    }

    return NextResponse.json({
      configured: true,
      connected: true,
      positions: details.positions,
      balances: details.balances,
    });
  } catch (error) {
    console.error('[SnapTrade] Holdings error:', error);
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}
