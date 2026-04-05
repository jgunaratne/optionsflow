import crypto from 'crypto';
import { getDb } from './db';
import { encryptToken, decryptToken } from './schwab';
import type {
  Broker, OptionsChainResponse, PriceHistoryResponse,
  AccountDetails, OrderResult, TokenStatus,
} from './broker';

// Webull OpenAPI - Production endpoints
// Docs: https://developer.webull.com/apis/docs/
const BASE_URL = 'https://api.webull.com';
const HOST = 'api.webull.com';

// Rate limiter: Webull limits account/trade endpoints to 10 req/30sec
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
}

// --- Credentials ---

function getAppCredentials() {
  const appKey = process.env.WEBULL_APP_KEY;
  const appSecret = process.env.WEBULL_APP_SECRET;
  if (!appKey || !appSecret) throw new Error('WEBULL_APP_KEY and WEBULL_APP_SECRET must be set in .env.local');
  return { appKey, appSecret };
}

// --- Token Management ---
// Tokens are created via /openapi/auth/token/create, verified via Webull App SMS,
// then stored in the DB. They expire after ~15 days.

interface WebullTokenData {
  access_token: string;
  expires_at: number; // unix ms
}

export function getStoredWebullToken(): WebullTokenData | null {
  return getStoredToken();
}

function getStoredToken(): WebullTokenData | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tokens WHERE broker = ?').get('webull') as {
    access_token: string; access_token_expires_at: number;
  } | undefined;
  if (!row) return null;
  return {
    access_token: decryptToken(row.access_token),
    expires_at: row.access_token_expires_at * 1000, // stored as seconds, convert to ms
  };
}

export function saveWebullToken(token: string, expiresRaw: number): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  // Webull docs say expires is ms, but handle both cases
  // If < 10 billion, it's seconds. If > 10 billion, it's milliseconds.
  const expiresMs = expiresRaw < 10_000_000_000 ? expiresRaw * 1000 : expiresRaw;
  const expSec = Math.floor(expiresMs / 1000);
  console.log(`[Webull] Saving token: expires ${new Date(expiresMs).toISOString()}, ${((expSec - now) / 86400).toFixed(1)} days left`);
  db.prepare(`
    INSERT OR REPLACE INTO tokens (broker, access_token, refresh_token,
      access_token_expires_at, refresh_token_expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('webull', encryptToken(token), encryptToken(''), expSec, expSec, now);
}

function getAccessToken(): string {
  const stored = getStoredToken();
  if (!stored) {
    throw new Error('No Webull access token found. Click "Connect Webull" to create one.');
  }

  if (Date.now() > stored.expires_at) {
    throw new Error('Webull access token has expired. Click "Connect Webull" to create a new one.');
  }
  return stored.access_token;
}

// --- Account ID (auto-discover or from env) ---

let cachedAccountId: string | null = null;

// --- Signature Generation ---
// Per: https://developer.webull.com/apis/docs/authentication/signature
//
// 1. Sort all param names (query + signature headers) ascending
// 2. Join as name1=value1&name2=value2 → str1
// 3. MD5(body) → uppercase → str2
// 4. str3 = path + "&" + str1 [+ "&" + str2 if body]
// 5. URL encode str3 → encoded_string
// 6. key = appSecret + "&"
// 7. signature = base64(HMAC-SHA1(key, encoded_string))

function generateSignature(
  appSecret: string,
  path: string,
  queryParams: Record<string, string>,
  signatureHeaders: Record<string, string>,
  body?: string,
): string {
  const allParams: Record<string, string> = { ...queryParams, ...signatureHeaders };
  const sortedKeys = Object.keys(allParams).sort();
  const str1 = sortedKeys.map(k => `${k}=${allParams[k]}`).join('&');

  let str3 = `${path}&${str1}`;
  if (body) {
    const str2 = crypto.createHash('md5').update(body).digest('hex').toUpperCase();
    str3 = `${str3}&${str2}`;
  }

  const encodedString = encodeURIComponent(str3);
  const key = `${appSecret}&`;
  return crypto.createHmac('sha1', key).update(encodedString).digest('base64');
}

// --- API Request Wrapper ---

async function webullRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  queryParams: Record<string, string> = {},
  body?: unknown,
  opts?: { skipAccessToken?: boolean },
): Promise<T> {
  await rateLimit();
  const { appKey, appSecret } = getAppCredentials();
  const timestamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z'); // RFC-3339 UTC
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const bodyStr = body ? JSON.stringify(body) : undefined;

  // Signature headers (these participate in signature computation)
  const signatureHeaders: Record<string, string> = {
    'host': HOST,
    'x-app-key': appKey,
    'x-signature-algorithm': 'HMAC-SHA1',
    'x-signature-nonce': nonce,
    'x-signature-version': '1.0',
    'x-timestamp': timestamp,
  };

  const signature = generateSignature(appSecret, path, queryParams, signatureHeaders, bodyStr);

  // Build full URL with query params
  const queryString = Object.keys(queryParams).length > 0
    ? '?' + Object.entries(queryParams).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';
  const url = `${BASE_URL}${path}${queryString}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-app-key': appKey,
    'x-app-secret': appSecret,
    'x-timestamp': timestamp,
    'x-signature': signature,
    'x-signature-algorithm': 'HMAC-SHA1',
    'x-signature-version': '1.0',
    'x-signature-nonce': nonce,
    'x-version': 'v2',
  };

  // Add access token for authenticated endpoints
  if (!opts?.skipAccessToken) {
    headers['x-access-token'] = getAccessToken();
  }

  const options: RequestInit = { method, headers };
  if (bodyStr) options.body = bodyStr;

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webull API error: ${response.status} ${method} ${path}: ${errorText}`);
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

// --- Auto-discover Account ID ---

async function getAccountId(): Promise<string> {
  if (process.env.WEBULL_ACCOUNT_ID) return process.env.WEBULL_ACCOUNT_ID;
  if (cachedAccountId) return cachedAccountId;

  const accounts = await webullRequest<Array<{ account_id: string; account_number?: string; account_type?: string; account_class?: string; account_label?: string; sec_account_id?: string; account_name?: string }>>(
    'GET', '/openapi/account/list'
  );
  console.log(`[Webull] All accounts:`, JSON.stringify(accounts));

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('No Webull accounts found. Check your API credentials.');
  }

  // Prefer margin accounts (where positions typically live), then cash, skip crypto/futures
  const preferred = accounts.find(a =>
    a.account_type === 'MARGIN' || a.account_class === 'INDIVIDUAL_MARGIN'
  ) || accounts.find(a =>
    a.account_type === 'CASH' && a.account_class !== 'CRYPTO'
  );
  const chosen = preferred || accounts[0];
  cachedAccountId = chosen.account_id;
  console.log(`[Webull] Using account: ${cachedAccountId} (type: ${chosen.account_type || 'unknown'}, ${accounts.length} total accounts)`);
  return cachedAccountId;
}

// --- Webull response types (per official OpenAPI spec) ---

interface WebullPositionLeg {
  leg_id: string;
  symbol: string;
  quantity?: string;
  option_type?: string;
  option_expire_date?: string;
  option_exercise_price?: string;
}

interface WebullPosition {
  position_id: string;
  symbol: string;
  quantity: string;
  instrument_type: string;  // EQUITY | OPTION | FUTURES | CRYPTO
  last_price: string;
  cost_price: string;
  unrealized_profit_loss: string;
  option_strategy?: string;
  currency: string;
  legs?: WebullPositionLeg[];
}

interface WebullCurrencyAsset {
  currency: string;
  cash_balance: string;
  buying_power: string;
  market_value: string;
  unrealized_profit_loss: string;
  net_liquidation_value?: string;
}

interface WebullBalanceResponse {
  total_cash_balance: string;
  total_market_value: string;
  total_unrealized_profit_loss: string;
  total_net_liquidation_value: string;
  maintenance_margin?: string;
  account_currency_assets: WebullCurrencyAsset[];
}

interface WebullAccountItem {
  account_id: string;
  account_number?: string;
  account_type?: string;
}

// --- WebullBroker Class ---

export class WebullBroker implements Broker {
  readonly name = 'Webull';

  isTokenExpiringSoon(): TokenStatus {
    try {
      const stored = getStoredToken();
      if (!stored) return { accessExpiring: true, refreshExpiring: true };
      const now = Date.now();
      return {
        accessExpiring: stored.expires_at < now + 24 * 60 * 60 * 1000, // < 1 day left
        refreshExpiring: false,
      };
    } catch {
      return { accessExpiring: true, refreshExpiring: true };
    }
  }

  /**
   * Create a new access token. Returns PENDING status — must be verified via Webull App SMS.
   */
  async createToken(): Promise<{ token: string; expires: number; status: string }> {
    return webullRequest<{ token: string; expires: number; status: string }>(
      'POST', '/openapi/auth/token/create', {}, undefined, { skipAccessToken: true }
    );
  }

  /**
   * Check token status. After SMS verification, status changes from PENDING → NORMAL
   * and expires gets updated to the real 15-day expiry.
   */
  async checkToken(token: string): Promise<{ token: string; expires: number; status: string }> {
    return webullRequest<{ token: string; expires: number; status: string }>(
      'POST', '/openapi/auth/token/check', {}, { token }, { skipAccessToken: true }
    );
  }

  async getAccountList(): Promise<WebullAccountItem[]> {
    return webullRequest<WebullAccountItem[]>('GET', '/openapi/account/list');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getOptionsChain(symbol: string, _contractType: string, _fromDate: string, _toDate: string): Promise<OptionsChainResponse> {
    // Webull options chain not available via their API yet (US_OPTION queries not supported)
    const putExpDateMap: Record<string, Record<string, OptionsChainResponse['putExpDateMap'][string][string]>> = {};
    let underlyingPrice = 0;

    try {
      const quoteData = await this.getQuotes([symbol]);
      const q = quoteData as { bids?: Array<{ price: string }>; asks?: Array<{ price: string }> };
      const bid = parseFloat(q?.bids?.[0]?.price || '0');
      const ask = parseFloat(q?.asks?.[0]?.price || '0');
      underlyingPrice = (bid + ask) / 2 || bid || ask;
    } catch { /* fallback to 0 */ }

    return { symbol, underlyingPrice, putExpDateMap };
  }

  async getQuotes(symbols: string[]): Promise<unknown> {
    const symbol = symbols[0];
    try {
      // Try Webull first
      const etfSymbols = new Set(['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'ARKK', 'XLF', 'XLE', 'XLK', 'GLD', 'SLV', 'TLT', 'HYG', 'EEM', 'IEFA', 'IGM', 'QQQM']);
      const category = etfSymbols.has(symbol.toUpperCase()) ? 'US_ETF' : 'US_STOCK';
      return await webullRequest('GET', '/openapi/market-data/stock/quotes', {
        symbol, category, depth: '1', overnight_required: 'false',
      });
    } catch {
      // Fallback to Yahoo Finance (free, no auth required)
      return this.yahooQuote(symbol);
    }
  }

  private async yahooQuote(symbol: string): Promise<unknown> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`Yahoo quote failed: ${res.status}`);
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No Yahoo quote data');
    return {
      bids: [{ price: String(meta.regularMarketPrice || 0) }],
      asks: [{ price: String(meta.regularMarketPrice || 0) }],
      lastPrice: String(meta.regularMarketPrice || 0),
      previousClose: String(meta.previousClose || meta.chartPreviousClose || 0),
      symbol,
    };
  }

  async getPriceHistory(symbol: string): Promise<PriceHistoryResponse> {
    try {
      // Try Webull first
      const etfSymbols = new Set(['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'ARKK', 'XLF', 'XLE', 'XLK', 'GLD', 'SLV', 'TLT', 'HYG', 'EEM', 'IEFA', 'IGM', 'QQQM']);
      const category = etfSymbols.has(symbol.toUpperCase()) ? 'US_ETF' : 'US_STOCK';
      const raw = await webullRequest<Array<{
        close: string; open: string; high: string; low: string; volume: string; time: string;
      }>>('GET', '/openapi/market-data/stock/bars', {
        symbol, category, timespan: 'D', count: '252', real_time_required: 'true',
      });
      const bars = Array.isArray(raw) ? raw : [];
      return {
        candles: bars.map(c => ({
          close: parseFloat(c.close) || 0, open: parseFloat(c.open) || 0,
          high: parseFloat(c.high) || 0, low: parseFloat(c.low) || 0,
          volume: parseInt(c.volume) || 0, datetime: new Date(c.time).getTime() || 0,
        })),
      };
    } catch {
      // Fallback to Yahoo Finance (free, 1 year of daily bars)
      return this.yahooPriceHistory(symbol);
    }
  }

  private async yahooPriceHistory(symbol: string): Promise<PriceHistoryResponse> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`Yahoo history failed: ${res.status}`);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('No Yahoo history data');

    const timestamps = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    return {
      candles: timestamps.map((t: number, i: number) => ({
        close: q.close?.[i] || 0,
        open: q.open?.[i] || 0,
        high: q.high?.[i] || 0,
        low: q.low?.[i] || 0,
        volume: q.volume?.[i] || 0,
        datetime: t * 1000,
      })).filter((c: { close: number }) => c.close > 0),
    };
  }

  async getAccountDetails(): Promise<AccountDetails> {
    const accountId = await getAccountId();

    const [balance, positions] = await Promise.all([
      webullRequest<WebullBalanceResponse>('GET', '/openapi/assets/balance', {
        account_id: accountId,
        total_asset_currency: 'USD',
      }),
      webullRequest<WebullPosition[]>('GET', '/openapi/assets/positions', {
        account_id: accountId,
      }),
    ]);



    const usdAsset = balance.account_currency_assets?.find(a => a.currency === 'USD');

    return {
      balances: {
        buyingPower: parseFloat(usdAsset?.buying_power || balance.total_cash_balance || '0'),
        liquidationValue: parseFloat(balance.total_net_liquidation_value || '0'),
        cashBalance: parseFloat(usdAsset?.cash_balance || balance.total_cash_balance || '0'),
        availableFunds: parseFloat(usdAsset?.buying_power || '0'),
        maintenanceRequirement: parseFloat(balance.maintenance_margin || '0'),
      },
      positions: (positions || []).map(p => {
        const isOption = p.instrument_type === 'OPTION';
        const leg = p.legs?.[0];
        return {
          shortQuantity: parseFloat(p.quantity) < 0 ? Math.abs(parseFloat(p.quantity)) : 0,
          longQuantity: parseFloat(p.quantity) > 0 ? parseFloat(p.quantity) : 0,
          averagePrice: parseFloat(p.cost_price) || 0,
          currentDayProfitLoss: parseFloat(p.unrealized_profit_loss) || 0,
          currentDayProfitLossPercentage: 0,
          marketValue: parseFloat(p.last_price) * parseFloat(p.quantity) || 0,
          maintenanceRequirement: 0,
          instrument: {
            symbol: isOption && leg ? leg.symbol : p.symbol,
            underlyingSymbol: isOption ? p.symbol : undefined,
            assetType: p.instrument_type,
            description: isOption && leg
              ? `${p.symbol} ${leg.option_expire_date} ${leg.option_exercise_price} ${leg.option_type}`
              : p.symbol,
            putCall: leg?.option_type,
          },
        };
      }),
    };
  }

  async submitOrder(orderBody: unknown): Promise<OrderResult> {
    const result = await webullRequest<{ order_id?: string; client_order_id?: string }>(
      'POST', '/openapi/trade/order/place', {}, orderBody
    );
    return { orderId: result?.order_id || result?.client_order_id || null, status: 'SUBMITTED' };
  }

  async dryRunOrder(orderBody: unknown): Promise<unknown> {
    return webullRequest('POST', '/openapi/trade/order/preview', {}, orderBody);
  }

  async cancelOrder(orderId: string): Promise<unknown> {
    return webullRequest('POST', '/openapi/trade/order/cancel', {}, { order_id: orderId });
  }

  async getOrders(): Promise<unknown> {
    const accountId = await getAccountId();
    return webullRequest('GET', '/openapi/trade/orders/open', { account_id: accountId });
  }

  buildOCCSymbol(symbol: string, expiry: string, callPut: 'C' | 'P', strike: number): string {
    const paddedSymbol = symbol.padEnd(6, ' ');
    const dateStr = expiry.replace(/-/g, '').slice(2);
    const strikeStr = Math.round(strike * 1000).toString().padStart(8, '0');
    return `${paddedSymbol}${dateStr}${callPut}${strikeStr}`;
  }

  buildCSPOrder(occSymbol: string, quantity: number, midPrice: number) {
    return {
      action: 'SELL', orderType: 'LMT', timeInForce: 'DAY',
      lmtPrice: midPrice.toFixed(2), quantity,
      comboType: 'NORMAL', optionOrder: true,
      orders: [{ action: 'SELL', orderType: 'LMT', timeInForce: 'DAY', quantity, ticker: { symbol: occSymbol } }],
    };
  }

  buildBullPutSpreadOrder(shortPutOCC: string, longPutOCC: string, quantity: number, netCredit: number) {
    return {
      action: 'SELL', orderType: 'NET_CREDIT', timeInForce: 'DAY',
      lmtPrice: netCredit.toFixed(2), quantity,
      comboType: 'SPREAD', optionOrder: true,
      orders: [
        { action: 'SELL', orderType: 'LMT', timeInForce: 'DAY', quantity, ticker: { symbol: shortPutOCC } },
        { action: 'BUY', orderType: 'LMT', timeInForce: 'DAY', quantity, ticker: { symbol: longPutOCC } },
      ],
    };
  }
}

export { saveWebullToken as saveWebullTokens };
