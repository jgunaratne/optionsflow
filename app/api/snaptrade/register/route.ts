import { NextResponse } from 'next/server';
import { registerSnapTradeUser, resetSnapTradeUserSecret, saveSnapTradeUser } from '@/lib/snaptrade';

/**
 * POST /api/snaptrade/register
 * Register a new SnapTrade user and store credentials.
 */
export async function POST() {
  try {
    const localUserId = `optionsflow_${Date.now()}`;

    try {
      const result = await registerSnapTradeUser(localUserId);
      const data = result as Record<string, unknown>;
      const userId = String(data.userId || localUserId);
      const userSecret = String(data.userSecret || '');

      if (!userSecret) {
        return NextResponse.json({ error: 'SnapTrade registration returned no user secret' }, { status: 502 });
      }

      saveSnapTradeUser(userId, userSecret);
      return NextResponse.json({ success: true, userId, message: 'SnapTrade user registered. Now connect a brokerage.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      // User might already exist — try resetting the secret
      if (msg.includes('already exists') || msg.includes('UNIQUE')) {
        const resetResult = await resetSnapTradeUserSecret(localUserId);
        const data = resetResult as Record<string, unknown>;
        const userSecret = String(data.userSecret || '');
        saveSnapTradeUser(localUserId, userSecret);
        return NextResponse.json({ success: true, userId: localUserId, message: 'SnapTrade user secret reset.' });
      }
      throw error;
    }
  } catch (error) {
    console.error('[SnapTrade] Register error:', error);
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}
