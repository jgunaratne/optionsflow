import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig } from '@/lib/db';

const ALLOWED_KEYS = [
  'screener_universe', 'sp500_batch_size',
  'iv_rank_min', 'dte_min', 'dte_max', 'delta_min', 'delta_max',
  'min_premium', 'max_bid_ask_spread_pct', 'max_position_pct',
  'max_deployed_pct', 'min_open_interest',
];

export async function GET() {
  try {
    const settings: Record<string, unknown> = {};
    for (const key of ALLOWED_KEYS) {
      settings[key] = getConfig(key);
    }
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[API] GET /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const updated: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      if (key === 'screener_universe') {
        if (value !== 'watchlist' && value !== 'sp500') continue;
        setConfig(key, value);
        updated[key] = value;
        continue;
      }
      if (typeof value !== 'number') continue;
      setConfig(key, value);
      updated[key] = value;
    }

    return NextResponse.json({ updated });
  } catch (error) {
    console.error('[API] PATCH /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
