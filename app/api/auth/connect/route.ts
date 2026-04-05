import { NextResponse } from 'next/server';
import { getActiveBrokerName } from '@/lib/broker-factory';
import { generatePKCE, getAuthorizationUrl } from '@/lib/schwab';

export async function POST() {
  try {
    const broker = getActiveBrokerName();

    if (broker === 'schwab') {
      const clientId = process.env.SCHWAB_CLIENT_ID;
      const clientSecret = process.env.SCHWAB_CLIENT_SECRET;
      const redirectUri = process.env.SCHWAB_REDIRECT_URI;
      const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

      if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
        return NextResponse.json({
          error: 'SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, SCHWAB_REDIRECT_URI, and TOKEN_ENCRYPTION_KEY must be set in .env.local',
          authType: 'credentials_missing',
        }, { status: 400 });
      }

      const { codeVerifier, codeChallenge } = generatePKCE();
      const state = crypto.randomUUID();
      const response = NextResponse.json({
        success: true,
        authType: 'oauth',
        redirectURI: getAuthorizationUrl(codeChallenge, state),
      });

      response.cookies.set('schwab_oauth_verifier', codeVerifier, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 10 * 60,
      });
      response.cookies.set('schwab_oauth_state', state, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 10 * 60,
      });

      return response;
    }

    if (broker === 'webull') {
      const appKey = process.env.WEBULL_APP_KEY;
      const appSecret = process.env.WEBULL_APP_SECRET;

      if (!appKey || !appSecret) {
        return NextResponse.json({
          error: 'WEBULL_APP_KEY and WEBULL_APP_SECRET must be set in .env.local',
          authType: 'credentials_missing',
        }, { status: 400 });
      }

      try {
        const { WebullBroker, saveWebullToken, getStoredWebullToken } = await import('@/lib/webull');
        const wb = new WebullBroker();

        // Step 1: Check if we already have a stored token
        const existingToken = getStoredWebullToken();

        if (existingToken) {
          // Check if the existing token has become NORMAL (verified via SMS)
          try {
            const checkResult = await wb.checkToken(existingToken.access_token);
            console.log('[Connect] Token check result:', JSON.stringify(checkResult));

            if (checkResult.status === 'NORMAL') {
              // Token verified! Update the expiry to the real 15-day value
              saveWebullToken(checkResult.token, checkResult.expires);
              return NextResponse.json({
                success: true,
                message: `Webull connected! Token is active until ${new Date(checkResult.expires < 10_000_000_000 ? checkResult.expires * 1000 : checkResult.expires).toLocaleDateString()}.`,
                tokenStatus: 'NORMAL',
              });
            }

            if (checkResult.status === 'PENDING') {
              return NextResponse.json({
                success: true,
                message: 'Token is still pending SMS verification. Open your Webull app and approve the API access request, then click Connect again.',
                tokenStatus: 'PENDING',
              });
            }

            // INVALID or EXPIRED — fall through to create new token
            console.log('[Connect] Token status:', checkResult.status, '→ creating new token');
          } catch (checkError) {
            console.log('[Connect] Token check failed, creating new:', checkError instanceof Error ? checkError.message : checkError);
          }
        }

        // Step 2: Create a new token
        const tokenResult = await wb.createToken();
        console.log('[Connect] Token created:', JSON.stringify({ ...tokenResult, token: tokenResult.token?.slice(0, 8) + '...' }));

        if (tokenResult.token) {
          saveWebullToken(tokenResult.token, tokenResult.expires);

          return NextResponse.json({
            success: true,
            message: 'Token created! Open your Webull app to verify via SMS, then click Connect again to activate.',
            tokenStatus: tokenResult.status,
          });
        }

        return NextResponse.json({
          error: 'Failed to create token - no token returned',
          authType: 'api_error',
        }, { status: 502 });
      } catch (apiError) {
        const msg = apiError instanceof Error ? apiError.message : String(apiError);
        // Handle 2FA rate limiting
        if (msg.includes('2FA_VERIFY_FAILED')) {
          return NextResponse.json({
            error: 'Please wait a moment before creating a new token. Check your Webull app for a pending verification request.',
            authType: '2fa_cooldown',
          }, { status: 429 });
        }
        return NextResponse.json({
          error: `Webull API error: ${msg}`,
          authType: 'api_error',
        }, { status: 502 });
      }
    }

    return NextResponse.json({ error: `Unknown broker: ${broker}` }, { status: 400 });
  } catch (error) {
    console.error('[API] POST /api/auth/connect error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
