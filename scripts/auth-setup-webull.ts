#!/usr/bin/env npx tsx

import crypto from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

const BASE_URL = 'https://api.webull.com/api';

async function main() {
  console.log('=== OptionsFlow Webull API Setup ===\n');

  // Check required env vars
  const required = ['WEBULL_APP_KEY', 'WEBULL_APP_SECRET', 'TOKEN_ENCRYPTION_KEY'];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`ERROR: ${key} is not set. Add it to .env.local`);
      process.exit(1);
    }
  }

  const appKey = process.env.WEBULL_APP_KEY!;
  const appSecret = process.env.WEBULL_APP_SECRET!;

  console.log('Webull uses App Key + App Secret authentication (not OAuth browser flow).\n');
  console.log('Requesting access token from Webull API...\n');

  try {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({ grant_type: 'client_credentials' });
    const content = `${appKey}|${timestamp}|${body}`;
    const signature = crypto.createHmac('sha256', appSecret).update(content).digest('hex');

    const response = await fetch(`${BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Key': appKey,
        'Timestamp': timestamp,
        'Sign': signature,
        'Sign-Type': 'HMAC',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
    }

    // Save tokens using the DB module
    const { saveTokens } = await import('../lib/schwab');
    saveTokens(data.access_token, data.refresh_token || '', data.expires_in || 86400, 'webull');

    console.log('✅ Webull tokens saved successfully!\n');
    console.log('You can now start the app with ACTIVE_BROKER=webull.\n');
  } catch (error) {
    console.error('Failed to authenticate with Webull:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Ensure your Webull API access has been approved');
    console.log('2. Verify WEBULL_APP_KEY and WEBULL_APP_SECRET are correct');
    console.log('3. Check that your brokerage account meets the $500 minimum');
    process.exit(1);
  }
}

main().catch(console.error);
