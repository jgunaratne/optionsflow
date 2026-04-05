import { NextRequest, NextResponse } from 'next/server';
import { generateConnectionPortalUrl, getSnapTradeUser } from '@/lib/snaptrade';

/**
 * POST /api/snaptrade/connect
 * Generate a SnapTrade Connection Portal URL.
 * Frontend opens this in a popup for the user to connect Schwab.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const broker = (body as Record<string, string>).broker || undefined;

    const user = getSnapTradeUser();
    if (!user) {
      return NextResponse.json(
        { error: 'SnapTrade not registered. Call POST /api/snaptrade/register first.' },
        { status: 400 }
      );
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const customRedirect = `${origin}/snaptrade-callback`;

    const result = await generateConnectionPortalUrl(user.userId, user.userSecret, {
      broker,
      customRedirect,
    });

    const loginResult = result as Record<string, unknown>;
    const redirectURI = loginResult.redirectURI || loginResult.loginLink;

    return NextResponse.json({ redirectURI });
  } catch (error) {
    console.error('[SnapTrade] Connect error:', error);
    return NextResponse.json(
      { error: `Failed to generate connection URL: ${error instanceof Error ? error.message : error}` },
      { status: 500 }
    );
  }
}
