import { NextResponse } from 'next/server';
import { getBroker } from '@/lib/broker-factory';

export async function GET() {
  try {
    const broker = getBroker();
    const { balances, positions } = await broker.getAccountDetails();
    const totalValue = balances.liquidationValue;
    const optionPositions = positions.filter(p => p.instrument.assetType === 'OPTION');
    const deployedCapital = optionPositions.reduce((sum, p) => sum + Math.abs(p.maintenanceRequirement || p.marketValue || 0), 0);

    return NextResponse.json({
      account: {
        totalValue, buyingPower: balances.buyingPower, cashBalance: balances.cashBalance,
        deployedCapital, deployedPct: totalValue > 0 ? deployedCapital / totalValue : 0,
        availableFunds: balances.availableFunds,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const noTraderApi = message.includes('Client not authorized') && message.includes('401');
    const needsAuth = message.includes('No tokens found')
      || message.includes('No Webull')
      || message.includes('auth-setup')
      || message.includes('must be set in .env')
      || message.includes('INVALID_TOKEN')
      || message.includes('access token')
      || message.includes('Client not authorized')
      || message.includes('Unauthorized')
      || message.includes('Failed to resolve Schwab account hash');
    if (noTraderApi) {
      console.warn('[API] GET /api/account trader_api_not_enabled');
      return NextResponse.json({
        error: 'trader_api_not_enabled',
        message: 'Schwab Trader API is not enabled for this app. Account data is unavailable. Add "Trader API" product in the Schwab developer portal to enable account features.',
        account: { totalValue: 0, buyingPower: 0, cashBalance: 0, deployedCapital: 0, deployedPct: 0, availableFunds: 0 },
      }, { status: 200 });
    }
    console.error('[API] GET /api/account error:', error);
    return NextResponse.json(
      { error: needsAuth ? 'not_authenticated' : 'Failed to fetch account data', message },
      { status: needsAuth ? 401 : 500 }
    );
  }
}
