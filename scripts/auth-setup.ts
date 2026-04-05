#!/usr/bin/env npx tsx

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { generatePKCE, getAuthorizationUrl, exchangeCodeForTokens } from '../lib/schwab';

// Load .env.local since tsx doesn't do it automatically
try {
  const envPath = resolve(__dirname, '..', '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env.local not found, rely on existing env */ }

const PORT = 3001;

async function main() {
  console.log('=== OptionsFlow Schwab OAuth Setup ===\n');

  // Check required env vars
  const required = ['SCHWAB_CLIENT_ID', 'SCHWAB_CLIENT_SECRET', 'SCHWAB_REDIRECT_URI', 'TOKEN_ENCRYPTION_KEY'];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`ERROR: ${key} is not set. Add it to .env.local`);
      process.exit(1);
    }
  }

  // Generate PKCE
  const { codeVerifier, codeChallenge } = generatePKCE();
  const authUrl = getAuthorizationUrl(codeChallenge);

  console.log('1. Open this URL in your browser to authorize:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. After authorizing, you will be redirected back.\n');
  console.log(`   Listening for callback on http://localhost:${PORT}...\n`);

  // Start temporary server to receive callback
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${PORT}`);

    if (url.pathname === '/api/auth/callback') {
      const code = url.searchParams.get('code');

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Error: No authorization code received</h1>');
        return;
      }

      try {
        await exchangeCodeForTokens(code, codeVerifier);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="font-family:system-ui;text-align:center;padding:50px;background:#0a0a0a;color:#fff"><h1>✅ Authorization Successful!</h1><p>Tokens saved. You can close this window and stop the script.</p></body></html>');
        console.log('\n✅ Tokens saved successfully! You can now start the app.\n');
        setTimeout(() => process.exit(0), 2000);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error: ${error instanceof Error ? error.message : 'Unknown error'}</h1>`);
        console.error('Token exchange failed:', error);
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(PORT, () => {
    console.log(`   Server listening on port ${PORT}...`);
  });
}

main().catch(console.error);
