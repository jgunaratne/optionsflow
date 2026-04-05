import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/schwab';
import { getBrokerName } from '@/lib/broker-factory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'Authorization code not found' }, { status: 400 });

    const codeVerifier = searchParams.get('code_verifier') || '';
    await exchangeCodeForTokens(code, codeVerifier);

    const brokerName = getBrokerName();
    return new NextResponse(
      `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;color:#fff"><div style="text-align:center"><h1>✅ Authorization Successful</h1><p>You can close this window. OptionsFlow is now connected to your ${brokerName} account.</p></div></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('[API] OAuth callback error:', error);
    return new NextResponse(
      `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;color:#f44"><div style="text-align:center"><h1>❌ Authorization Failed</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p></div></body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 500 }
    );
  }
}
