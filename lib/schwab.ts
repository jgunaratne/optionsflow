import crypto from 'crypto';
import { getDb, getConfig, setConfig } from './db';
import type {
  Broker, OptionsChainResponse, PriceHistoryResponse,
  AccountDetails, OrderResult, TokenStatus,
} from './broker';

const AUTH_URL = 'https://api.schwabapi.com/v1/oauth/authorize';
const TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';
const BASE_URL = 'https://api.schwabapi.com/trader/v1';
const MARKET_DATA_URL = 'https://api.schwabapi.com/marketdata/v1';

// Rate limiter: 120 requests/min, 600ms spacing
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 600;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
}

// --- Token Encryption (AES-256-GCM) ---
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY not set');
  return Buffer.from(key.padEnd(KEY_LENGTH, '0').slice(0, KEY_LENGTH), 'utf-8');
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptToken(encoded: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encoded, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf-8');
}

// --- Token Management ---

interface TokenData {
  access_token: string;
  refresh_token: string;
  access_token_expires_at: number;
  refresh_token_expires_at: number;
}

function getTokens(broker = 'schwab'): TokenData | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tokens WHERE broker = ?').get(broker) as {
    access_token: string; refresh_token: string;
    access_token_expires_at: number; refresh_token_expires_at: number;
  } | undefined;
  if (!row) return null;
  return {
    access_token: decryptToken(row.access_token),
    refresh_token: decryptToken(row.refresh_token),
    access_token_expires_at: row.access_token_expires_at,
    refresh_token_expires_at: row.refresh_token_expires_at,
  };
}

export function hasSchwabTokens(): boolean {
  try {
    return getTokens('schwab') !== null;
  } catch {
    return false;
  }
}

export function saveTokens(accessToken: string, refreshToken: string, expiresIn: number, broker = 'schwab'): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT OR REPLACE INTO tokens (broker, access_token, refresh_token,
      access_token_expires_at, refresh_token_expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(broker, encryptToken(accessToken), encryptToken(refreshToken), now + expiresIn, now + 7 * 24 * 60 * 60, now);
}

async function refreshAccessToken(): Promise<string> {
  const tokens = getTokens('schwab');
  if (!tokens) throw new Error('No tokens found. Run auth-setup first.');
  const now = Math.floor(Date.now() / 1000);
  if (tokens.refresh_token_expires_at < now) {
    throw new Error('REFRESH_TOKEN_EXPIRED: Refresh token has expired. Re-authorize via auth-setup.');
  }
  const basicAuth = Buffer.from(`${process.env.SCHWAB_CLIENT_ID}:${process.env.SCHWAB_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  saveTokens(data.access_token, data.refresh_token || tokens.refresh_token, data.expires_in, 'schwab');
  return data.access_token;
}

async function getValidAccessToken(): Promise<string> {
  const tokens = getTokens('schwab');
  if (!tokens) throw new Error('No tokens found. Run auth-setup first.');
  const now = Math.floor(Date.now() / 1000);
  if (tokens.access_token_expires_at > now + 5 * 60) return tokens.access_token;
  return refreshAccessToken();
}

// --- API Request Wrapper ---

async function schwabRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, isMarketData = false
): Promise<T> {
  await rateLimit();
  const accessToken = await getValidAccessToken();
  const baseUrl = isMarketData ? MARKET_DATA_URL : BASE_URL;
  const url = `${baseUrl}${path}`;
  const options: RequestInit = {
    method,
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
    (options.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Schwab API error: ${response.status} ${method} ${path}: ${errorText}`);
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

// --- Account Hash ---
let cachedAccountHash: string | null = null;

function getConfiguredAccountHash(): string | null {
  const envHash = process.env.SCHWAB_ACCOUNT_HASH?.trim();
  if (envHash) return envHash;

  try {
    const dbHash = getConfig('schwab_account_hash');
    return typeof dbHash === 'string' && dbHash.trim() ? dbHash.trim() : null;
  } catch {
    return null;
  }
}

async function getAccountHash(): Promise<string> {
  if (cachedAccountHash) return cachedAccountHash;

  const configuredHash = getConfiguredAccountHash();
  if (configuredHash) {
    cachedAccountHash = configuredHash;
    return cachedAccountHash;
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const accounts = await schwabRequest<Array<{ hashValue: string }>>('GET', '/accounts/accountNumbers');
      if (!accounts || accounts.length === 0) throw new Error('No Schwab accounts found');
      cachedAccountHash = accounts[0].hashValue;
      setConfig('schwab_account_hash', cachedAccountHash);
      return cachedAccountHash;
    } catch (error) {
      lastError = error;
      const errMsg = error instanceof Error ? error.message : '';
      // Preserve auth/setup failures instead of wrapping them as account-hash failures.
      if (
        errMsg.includes('No tokens found')
        || errMsg.includes('REFRESH_TOKEN_EXPIRED')
        || errMsg.includes('Token refresh failed')
      ) {
        throw error;
      }
      // Preserve 401 permissions issues instead of wrapping them as account-hash failures.
      if (errMsg.includes('401') && errMsg.includes('Client not authorized')) {
        throw error;
      }
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, attempt * 750));
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Failed to resolve Schwab account hash. ${message}. ` +
    'Reconnect Schwab or set SCHWAB_ACCOUNT_HASH in .env.local if you already know the hashed account id.'
  );
}

// --- OAuth Helpers ---
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function getAuthorizationUrl(codeChallenge: string, state?: string): string {
  const params = new URLSearchParams({
    response_type: 'code', client_id: process.env.SCHWAB_CLIENT_ID!,
    redirect_uri: process.env.SCHWAB_REDIRECT_URI!, code_challenge: codeChallenge, code_challenge_method: 'S256',
  });
  if (state) params.set('state', state);
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<void> {
  const basicAuth = Buffer.from(`${process.env.SCHWAB_CLIENT_ID}:${process.env.SCHWAB_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: process.env.SCHWAB_REDIRECT_URI!, code_verifier: codeVerifier,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  saveTokens(data.access_token, data.refresh_token, data.expires_in, 'schwab');
}

// --- Raw Schwab API response types ---
interface SchwabChainContract {
  putCall: string; symbol: string; bid: number; ask: number; delta: number;
  theta: number; vega: number; openInterest: number; daysToExpiration: number;
  strikePrice: number; expirationDate: string;
}

interface SchwabChainResponse {
  symbol: string;
  underlyingPrice?: number;
  underlying?: { mark: number; last: number };
  putExpDateMap?: Record<string, Record<string, SchwabChainContract[]>>;
  callExpDateMap?: Record<string, Record<string, SchwabChainContract[]>>;
}

interface SchwabAccountResponse {
  securitiesAccount?: {
    currentBalances?: {
      buyingPower?: number; liquidationValue?: number;
      cashBalance?: number; availableFunds?: number; maintenanceRequirement?: number;
    };
    positions?: Array<{
      shortQuantity: number; longQuantity: number; averagePrice: number;
      currentDayProfitLoss: number; currentDayProfitLossPercentage: number;
      marketValue: number; maintenanceRequirement?: number;
      instrument: {
        symbol: string; assetType: string;
        putCall?: string; underlyingSymbol?: string; description?: string;
      };
    }>;
  };
}

// --- SchwabBroker Class ---

export class SchwabBroker implements Broker {
  readonly name = 'Schwab';

  isTokenExpiringSoon(): TokenStatus {
    const tokens = getTokens('schwab');
    if (!tokens) return { accessExpiring: true, refreshExpiring: true };
    const now = Math.floor(Date.now() / 1000);
    return {
      accessExpiring: tokens.access_token_expires_at < now + 5 * 60,
      refreshExpiring: tokens.refresh_token_expires_at < now + 24 * 60 * 60,
    };
  }

  async getOptionsChain(symbol: string, contractType: string, fromDate: string, toDate: string): Promise<OptionsChainResponse> {
    const raw = await schwabRequest<SchwabChainResponse>('GET',
      `/chains?symbol=${symbol}&contractType=${contractType}&includeUnderlyingQuote=true&strategy=SINGLE&range=OTM&fromDate=${fromDate}&toDate=${toDate}`,
      undefined, true
    );
    const underlyingPrice = raw.underlying?.mark || raw.underlying?.last || raw.underlyingPrice || 0;
    const dateMap = contractType === 'CALL' ? raw.callExpDateMap : raw.putExpDateMap;
    return {
      symbol: raw.symbol || symbol,
      underlyingPrice,
      putExpDateMap: dateMap || {},
    };
  }

  async getQuotes(symbols: string[]): Promise<unknown> {
    return schwabRequest('GET', `/quotes?symbols=${symbols.join(',')}`, undefined, true);
  }

  async getPriceHistory(symbol: string): Promise<PriceHistoryResponse> {
    const raw = await schwabRequest<{ candles?: Array<{ close: number; open?: number; high?: number; low?: number; volume?: number; datetime?: number }> }>('GET',
      `/${symbol}/pricehistory?periodType=year&period=1&frequencyType=daily&frequency=1`, undefined, true
    );
    return { candles: raw.candles || [] };
  }

  async getAccountDetails(): Promise<AccountDetails> {
    const hash = await getAccountHash();
    const raw = await schwabRequest<SchwabAccountResponse>('GET', `/accounts/${hash}?fields=positions`);
    const balances = raw?.securitiesAccount?.currentBalances;
    const positions = raw?.securitiesAccount?.positions || [];
    return {
      balances: {
        buyingPower: balances?.buyingPower || 0,
        liquidationValue: balances?.liquidationValue || 0,
        cashBalance: balances?.cashBalance || 0,
        availableFunds: balances?.availableFunds || 0,
        maintenanceRequirement: balances?.maintenanceRequirement || 0,
      },
      positions: positions.map(p => ({
        shortQuantity: p.shortQuantity,
        longQuantity: p.longQuantity,
        averagePrice: p.averagePrice,
        currentDayProfitLoss: p.currentDayProfitLoss,
        currentDayProfitLossPercentage: p.currentDayProfitLossPercentage,
        marketValue: p.marketValue,
        maintenanceRequirement: p.maintenanceRequirement || 0,
        instrument: {
          symbol: p.instrument.symbol,
          assetType: p.instrument.assetType,
          putCall: p.instrument.putCall,
          underlyingSymbol: p.instrument.underlyingSymbol,
          description: p.instrument.description,
        },
      })),
    };
  }

  async submitOrder(orderBody: unknown): Promise<OrderResult> {
    const hash = await getAccountHash();
    const result = await schwabRequest<{ orderId?: string }>('POST', `/accounts/${hash}/orders`, orderBody);
    return { orderId: result?.orderId || null, status: 'SUBMITTED' };
  }

  async dryRunOrder(orderBody: unknown): Promise<unknown> {
    const hash = await getAccountHash();
    return schwabRequest('POST', `/accounts/${hash}/orders/dryrun`, orderBody);
  }

  async cancelOrder(orderId: string): Promise<unknown> {
    const hash = await getAccountHash();
    return schwabRequest('DELETE', `/accounts/${hash}/orders/${orderId}`);
  }

  async getOrders(): Promise<unknown> {
    const hash = await getAccountHash();
    return schwabRequest('GET', `/accounts/${hash}/orders`);
  }

  buildOCCSymbol(symbol: string, expiry: string, callPut: 'C' | 'P', strike: number): string {
    const paddedSymbol = symbol.padEnd(6, ' ');
    const dateStr = expiry.replace(/-/g, '').slice(2);
    const strikeStr = Math.round(strike * 1000).toString().padStart(8, '0');
    return `${paddedSymbol}${dateStr}${callPut}${strikeStr}`;
  }

  buildCSPOrder(occSymbol: string, quantity: number, midPrice: number) {
    return {
      orderType: 'LIMIT', session: 'NORMAL', duration: 'DAY', orderStrategyType: 'SINGLE',
      price: midPrice.toFixed(2),
      orderLegCollection: [{ instruction: 'SELL_TO_OPEN', quantity, instrument: { symbol: occSymbol, assetType: 'OPTION' } }],
    };
  }

  buildBullPutSpreadOrder(shortPutOCC: string, longPutOCC: string, quantity: number, netCredit: number) {
    return {
      orderType: 'NET_CREDIT', session: 'NORMAL', duration: 'DAY', orderStrategyType: 'SINGLE',
      price: netCredit.toFixed(2),
      orderLegCollection: [
        { instruction: 'SELL_TO_OPEN', quantity, instrument: { symbol: shortPutOCC, assetType: 'OPTION' } },
        { instruction: 'BUY_TO_OPEN', quantity, instrument: { symbol: longPutOCC, assetType: 'OPTION' } },
      ],
    };
  }
}

export { AUTH_URL, TOKEN_URL, BASE_URL };
