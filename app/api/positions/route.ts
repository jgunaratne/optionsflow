import { NextResponse } from 'next/server';
import { getActiveBrokerName, getBroker } from '@/lib/broker-factory';
import { getCachedAccountPayload, saveCachedAccountPayload } from '@/lib/account-cache';
import { getSnapTradeHoldings, isSnapTradeConfigured } from '@/lib/snaptrade';
import type { AccountBalances, Position } from '@/lib/broker';

type ApiPosition = {
  symbol: string;
  optionSymbol: string | null;
  description: string;
  assetType: string;
  putCall: string | null;
  quantity: number;
  averagePrice: number;
  marketValue: number;
  dayPnL: number;
  dayPnLPct: number;
  source: string;
};

const EMPTY_BALANCES: AccountBalances = {
  buyingPower: 0,
  liquidationValue: 0,
  cashBalance: 0,
  availableFunds: 0,
  maintenanceRequirement: 0,
};

function mapPosition(position: Position, source: string): ApiPosition {
  return {
    symbol: position.instrument.underlyingSymbol || position.instrument.symbol,
    optionSymbol: position.instrument.assetType === 'OPTION' ? position.instrument.symbol : null,
    description: position.instrument.description || '',
    assetType: position.instrument.assetType,
    putCall: position.instrument.putCall || null,
    quantity: position.shortQuantity || position.longQuantity,
    averagePrice: position.averagePrice,
    marketValue: position.marketValue,
    dayPnL: position.currentDayProfitLoss,
    dayPnLPct: position.currentDayProfitLossPercentage,
    source,
  };
}

function getErrorResponse(message: string) {
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
    return NextResponse.json({
      error: 'trader_api_not_enabled',
      message: 'Schwab Trader API not enabled. Positions unavailable.',
      positions: [],
      balances: EMPTY_BALANCES,
      schwabBalances: null,
      cachedAt: null,
      source: 'live',
    }, { status: 200 });
  }

  return NextResponse.json(
    { error: needsAuth ? 'not_authenticated' : 'Failed to fetch positions', message },
    { status: needsAuth ? 401 : 500 }
  );
}

async function buildResponseFromPayload(
  brokerName: string,
  positions: Position[],
  balances: AccountBalances,
  source: 'cache' | 'live',
  cachedAt: number
) {
  const allPositions = positions.map((position) => mapPosition(position, brokerName));

  let schwabBalances = null;
  if (source === 'live' && brokerName !== 'snaptrade' && isSnapTradeConfigured()) {
    try {
      const schwab = await getSnapTradeHoldings();
      if (schwab) {
        schwab.positions.forEach((position) => allPositions.push(mapPosition(position, 'schwab')));
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
    cachedAt,
    source,
  });
}

export async function GET() {
  const brokerName = getActiveBrokerName();
  const snapshot = getCachedAccountPayload(brokerName);

  if (!snapshot) {
    return NextResponse.json(
      {
        error: 'no_cached_data',
        message: `No cached positions for ${brokerName}. Use Refresh from ${brokerName === 'schwab' ? 'Schwab' : brokerName} to load them.`,
        positions: [],
        balances: EMPTY_BALANCES,
        schwabBalances: null,
        cachedAt: null,
        source: 'cache',
      },
      { status: 404 }
    );
  }

  return buildResponseFromPayload(
    brokerName,
    snapshot.payload.positions,
    snapshot.payload.balances,
    'cache',
    snapshot.updated_at
  );
}

export async function POST() {
  try {
    const broker = getBroker();
    const brokerName = getActiveBrokerName();
    const payload = await broker.getAccountDetails();
    const snapshot = saveCachedAccountPayload(brokerName, payload);

    return buildResponseFromPayload(
      brokerName,
      payload.positions,
      payload.balances,
      'live',
      snapshot.updatedAt
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/positions error:', error);
    return getErrorResponse(message);
  }
}
