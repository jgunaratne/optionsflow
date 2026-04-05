import { Snaptrade } from 'snaptrade-typescript-sdk';
import { getDb } from './db';
import type {
  Broker, OptionsChainResponse, PriceHistoryResponse,
  AccountDetails, OrderResult, TokenStatus, Position, AccountBalances,
} from './broker';

// --- SDK Client ---

let _client: Snaptrade | null = null;

function getClient(): Snaptrade {
  if (!_client) {
    const clientId = process.env.SNAPTRADE_CLIENT_ID;
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
    if (!clientId || !consumerKey) {
      throw new Error('SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY must be set in .env.local');
    }
    _client = new Snaptrade({ clientId, consumerKey });
  }
  return _client;
}

// --- User Credentials (stored in DB) ---

interface SnapTradeUser {
  userId: string;
  userSecret: string;
}

function getSnapTradeUser(): SnapTradeUser | null {
  const db = getDb();
  const row = db.prepare('SELECT access_token, refresh_token FROM tokens WHERE broker = ?')
    .get('snaptrade') as { access_token: string; refresh_token: string } | undefined;
  if (!row || !row.access_token || !row.refresh_token) return null;
  return { userId: row.access_token, userSecret: row.refresh_token };
}

function getSnapTradeUserOrThrow(): SnapTradeUser {
  const user = getSnapTradeUser();
  if (!user) throw new Error('SnapTrade not connected. Register and connect a brokerage first.');
  return user;
}

export function saveSnapTradeUser(userId: string, userSecret: string): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const far = now + 365 * 86400; // 1 year
  db.prepare(`
    INSERT OR REPLACE INTO tokens (broker, access_token, refresh_token,
      access_token_expires_at, refresh_token_expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('snaptrade', userId, userSecret, far, far, now);
}

// --- SnapTrade API wrappers ---

export async function registerSnapTradeUser(localUserId: string) {
  const res = await getClient().authentication.registerSnapTradeUser({ userId: localUserId });
  return res.data;
}

export async function resetSnapTradeUserSecret(userId: string) {
  const res = await getClient().authentication.resetSnapTradeUserSecret({ userId });
  return res.data;
}

export async function generateConnectionPortalUrl(
  userId: string, userSecret: string, opts?: { broker?: string; customRedirect?: string }
) {
  const res = await getClient().authentication.loginSnapTradeUser({
    userId, userSecret, broker: opts?.broker, customRedirect: opts?.customRedirect,
  });
  return res.data;
}

export async function listSnapTradeAccounts(userId: string, userSecret: string) {
  const res = await getClient().accountInformation.listUserAccounts({ userId, userSecret });
  return res.data;
}

export async function getSnapTradePositions(userId: string, userSecret: string, accountId: string) {
  const res = await getClient().accountInformation.getUserAccountPositions({ userId, userSecret, accountId });
  return res.data;
}

export async function getSnapTradeBalances(userId: string, userSecret: string, accountId: string) {
  const res = await getClient().accountInformation.getUserAccountBalance({ userId, userSecret, accountId });
  return res.data;
}

// --- Yahoo Finance helpers (shared with Webull) ---

async function yahooQuote(symbol: string): Promise<unknown> {
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
    symbol,
  };
}

async function yahooPriceHistory(symbol: string): Promise<PriceHistoryResponse> {
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
      close: q.close?.[i] || 0, open: q.open?.[i] || 0,
      high: q.high?.[i] || 0, low: q.low?.[i] || 0,
      volume: q.volume?.[i] || 0, datetime: t * 1000,
    })).filter((c: { close: number }) => c.close > 0),
  };
}

// --- SnapTrade Broker Implementation ---

export class SnapTradeBroker implements Broker {
  readonly name = 'SnapTrade (Schwab)';

  isTokenExpiringSoon(): TokenStatus {
    const user = getSnapTradeUser();
    return { accessExpiring: !user, refreshExpiring: !user };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getOptionsChain(_symbol: string, _contractType: string, _fromDate: string, _toDate: string): Promise<OptionsChainResponse> {
    // SnapTrade doesn't provide options chain data
    return { symbol: _symbol, underlyingPrice: 0, putExpDateMap: {} };
  }

  async getQuotes(symbols: string[]): Promise<unknown> {
    return yahooQuote(symbols[0]);
  }

  async getPriceHistory(symbol: string): Promise<PriceHistoryResponse> {
    return yahooPriceHistory(symbol);
  }

  async getAccountDetails(): Promise<AccountDetails> {
    const { userId, userSecret } = getSnapTradeUserOrThrow();
    const accounts = await listSnapTradeAccounts(userId, userSecret);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return { balances: emptyBalances(), positions: [] };
    }

    // Fetch positions + balances for all accounts in parallel
    const results = await Promise.allSettled(
      accounts.map(async (acct) => {
        const acctObj = acct as Record<string, unknown>;
        const accountId = String(acctObj.id || '');
        const [positions, balances] = await Promise.all([
          getSnapTradePositions(userId, userSecret, accountId).catch(() => []),
          getSnapTradeBalances(userId, userSecret, accountId).catch(() => []),
        ]);
        return { acctObj, positions, balances };
      })
    );

    const allPositions: Position[] = [];
    let totalBuyingPower = 0;
    let totalLiquidation = 0;
    let totalCash = 0;

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { positions, balances } = result.value;

      // Map SnapTrade positions to our Position format
      if (Array.isArray(positions)) {
        for (const pos of positions) {
          const sym = pos.symbol as Record<string, unknown> | string | undefined;
          let ticker = 'N/A';
          let description = '';
          if (typeof sym === 'string') {
            ticker = sym;
          } else if (sym) {
            const rawTicker = sym.symbol;
            ticker = typeof rawTicker === 'string' ? rawTicker
              : (typeof rawTicker === 'object' && rawTicker !== null && 'symbol' in rawTicker)
                ? String((rawTicker as Record<string, unknown>).symbol) : String(rawTicker || 'N/A');
            description = String(sym.description || sym.name || '');
          }

          const units = pos.units || 0;
          const price = pos.price || 0;
          const value = units * price;
          const avgPrice = pos.average_purchase_price || price;

          allPositions.push({
            shortQuantity: 0,
            longQuantity: units,
            averagePrice: avgPrice,
            currentDayProfitLoss: pos.open_pnl || 0,
            currentDayProfitLossPercentage: avgPrice > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0,
            marketValue: value,
            maintenanceRequirement: 0,
            instrument: { symbol: ticker, assetType: 'EQUITY', description },
          });
        }
      }

      // Extract balances
      if (Array.isArray(balances)) {
        for (const bal of balances) {
          const b = bal as Record<string, unknown>;
          totalCash += (b.cash as number) || 0;
          totalBuyingPower += (b.buying_power as number) || (b.cash as number) || 0;
          totalLiquidation += (b.total_value as number) || (b.cash as number) || 0;
        }
      }
    }

    return {
      balances: {
        buyingPower: totalBuyingPower,
        liquidationValue: totalLiquidation,
        cashBalance: totalCash,
        availableFunds: totalBuyingPower,
        maintenanceRequirement: 0,
      },
      positions: allPositions,
    };
  }

  // --- Order methods (read-only for SnapTrade) ---

  async submitOrder(): Promise<OrderResult> {
    throw new Error('Order submission not supported via SnapTrade. Use Webull for trading.');
  }

  async dryRunOrder(): Promise<unknown> {
    throw new Error('Order dry-run not supported via SnapTrade. Use Webull for trading.');
  }

  async cancelOrder(): Promise<unknown> {
    throw new Error('Order cancellation not supported via SnapTrade. Use Webull for trading.');
  }

  async getOrders(): Promise<unknown> {
    return [];
  }

  buildOCCSymbol(symbol: string, expiry: string, callPut: 'C' | 'P', strike: number): string {
    const exp = expiry.replace(/-/g, '').slice(2);
    const strikeStr = String(Math.round(strike * 1000)).padStart(8, '0');
    return `${symbol.padEnd(6)}${exp}${callPut}${strikeStr}`;
  }

  buildCSPOrder(): unknown {
    throw new Error('Order building not supported via SnapTrade. Use Webull for trading.');
  }

  buildBullPutSpreadOrder(): unknown {
    throw new Error('Order building not supported via SnapTrade. Use Webull for trading.');
  }
}

function emptyBalances(): AccountBalances {
  return { buyingPower: 0, liquidationValue: 0, cashBalance: 0, availableFunds: 0, maintenanceRequirement: 0 };
}

// --- Multi-broker helper: Get SnapTrade holdings alongside active broker ---

export async function getSnapTradeHoldings(): Promise<AccountDetails | null> {
  try {
    const user = getSnapTradeUser();
    if (!user) return null;
    const broker = new SnapTradeBroker();
    return await broker.getAccountDetails();
  } catch (error) {
    console.error('[SnapTrade] Holdings fetch error:', error instanceof Error ? error.message : error);
    return null;
  }
}

export function isSnapTradeConfigured(): boolean {
  return !!getSnapTradeUser() && !!process.env.SNAPTRADE_CLIENT_ID;
}

// Re-export for convenience
export { getSnapTradeUser };
