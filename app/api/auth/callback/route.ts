import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/schwab';
import { getBrokerName } from '@/lib/broker-factory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const authError = searchParams.get('error');
    const authErrorDescription = searchParams.get('error_description');
    if (authError) {
      throw new Error(authErrorDescription || authError);
    }
    const state = searchParams.get('state');
    if (!code) return NextResponse.json({ error: 'Authorization code not found' }, { status: 400 });

    const codeVerifier = request.cookies.get('schwab_oauth_verifier')?.value || searchParams.get('code_verifier') || '';
    const expectedState = request.cookies.get('schwab_oauth_state')?.value || '';
    if (!codeVerifier) {
      throw new Error('Missing PKCE verifier. Start the Schwab connection again from OptionsFlow.');
    }
    if (expectedState && state !== expectedState) {
      throw new Error('OAuth state mismatch. Start the Schwab connection again from OptionsFlow.');
    }

    await exchangeCodeForTokens(code, codeVerifier);

    const brokerName = getBrokerName();
    const response = new NextResponse(
      `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;color:#fff"><div style="text-align:center"><h1>Authorization Successful</h1><p>You can close this window. OptionsFlow is now connected to your ${brokerName} account.</p></div><script>if(window.opener){window.opener.postMessage({type:'schwab-connected'}, window.location.origin);window.close();}</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
    response.cookies.set('schwab_oauth_verifier', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    response.cookies.set('schwab_oauth_state', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    console.error('[API] OAuth callback error:', error);
    const response = new NextResponse(
      `<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;color:#f44"><div style="text-align:center"><h1>Authorization Failed</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p></div><script>if(window.opener){window.opener.postMessage({type:'schwab-auth-error',message:${JSON.stringify(error instanceof Error ? error.message : 'Unknown error')}}, window.location.origin);}</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 500 }
    );
    response.cookies.set('schwab_oauth_verifier', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    response.cookies.set('schwab_oauth_state', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    return response;
  }
}
