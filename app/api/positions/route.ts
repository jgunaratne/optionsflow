import { NextResponse } from 'next/server';
import { getBroker, getActiveBrokerName } from '@/lib/broker-factory';
import { getSnapTradeHoldings, isSnapTradeConfigured } from '@/lib/snaptrade';

export async function GET() {
  try {
    const broker = getBroker();
    const { positions, balances } = await broker.getAccountDetails();

    const mapPositions = (p: typeof positions[0], source: string) => ({
      symbol: p.instrument.underlyingSymbol || p.instrument.symbol,
      optionSymbol: p.instrument.assetType === 'OPTION' ? p.instrument.symbol : null,
      description: p.instrument.description || '',
      assetType: p.instrument.assetType,
      putCall: p.instrument.putCall || null,
      quantity: p.shortQuantity || p.longQuantity,
      averagePrice: p.averagePrice,
      marketValue: p.marketValue,
      dayPnL: p.currentDayProfitLoss,
      dayPnLPct: p.currentDayProfitLossPercentage,
      source,
    });

    const brokerName = getActiveBrokerName();
    const allPositions = positions.map(p => mapPositions(p, brokerName));

    // If active broker isn't snaptrade, also pull SnapTrade (Schwab) data
    let schwabBalances = null;
    if (brokerName !== 'snaptrade' && isSnapTradeConfigured()) {
      try {
        const schwab = await getSnapTradeHoldings();
        if (schwab) {
          schwab.positions.forEach(p => allPositions.push(mapPositions(p, 'schwab')));
          schwabBalances = schwab.balances;
        }
      } catch (err) {
        console.error('[Positions] SnapTrade merge error:', err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json({
      positions: allPositions,
      balances,
      schwabBalances,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const needsAuth = message.includes('No tokens found') || message.includes('No Webull')
      || message.includes('auth-setup') || message.includes('must be set in .env')
      || message.includes('INVALID_TOKEN') || message.includes('access token');
    console.error('[API] GET /api/positions error:', error);
    return NextResponse.json(
      { error: needsAuth ? 'not_authenticated' : 'Failed to fetch positions', message },
      { status: needsAuth ? 401 : 500 }
    );
  }
}
