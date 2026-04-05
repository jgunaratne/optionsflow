import { getWatchlist, getConfig, setConfig, insertCandidate, cleanOldCandidates } from './db';
import { analyzeCandidate } from './ai';
import { fetchTickerNews } from './news';
import type { Broker } from './broker';
import { SchwabBroker, hasSchwabTokens } from './schwab';
import { WebullBroker } from './webull';

interface IVRankCache { ivRank: number; cachedAt: number; }

interface ScreenerProgress {
  running: boolean;
  currentSymbol: string;
  currentIndex: number;
  totalSymbols: number;
  status: string;
  candidatesFound: number;
}

let progress: ScreenerProgress = {
  running: false, currentSymbol: '', currentIndex: 0,
  totalSymbols: 0, status: 'idle', candidatesFound: 0,
};

export function isScreenerRunning(): boolean {
  return progress.running;
}

export function getScreenerProgress(): ScreenerProgress {
  return { ...progress };
}

async function calculateIVRank(symbol: string, broker: Broker): Promise<number> {
  const cacheKey = `iv_rank_cache_${symbol}`;
  const cached = getConfig(cacheKey) as IVRankCache | undefined;
  const now = Math.floor(Date.now() / 1000);

  if (cached && (now - cached.cachedAt) < 86400) return cached.ivRank;

  try {
    const history = await broker.getPriceHistory(symbol);
    if (!history?.candles || history.candles.length < 30) return 50;

    const candles = history.candles;
    const returns = candles.slice(1).map((c, i) => Math.log(c.close / candles[i].close));
    const windowSize = 20;
    const hvValues: number[] = [];

    for (let i = windowSize; i <= returns.length; i++) {
      const window = returns.slice(i - windowSize, i);
      const mean = window.reduce((s, v) => s + v, 0) / windowSize;
      const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / (windowSize - 1);
      hvValues.push(Math.sqrt(variance * 252) * 100);
    }

    if (hvValues.length === 0) return 50;
    const currentIV = hvValues[hvValues.length - 1];
    const minIV = Math.min(...hvValues);
    const maxIV = Math.max(...hvValues);
    const ivRank = maxIV !== minIV ? ((currentIV - minIV) / (maxIV - minIV)) * 100 : 50;
    const clamped = Math.max(0, Math.min(100, ivRank));
    setConfig(cacheKey, { ivRank: clamped, cachedAt: now });
    return clamped;
  } catch (error) {
    console.error(`[Screener] IV Rank calc failed for ${symbol}:`, error);
    return 50;
  }
}

function getDateString(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

export async function runScreener(): Promise<void> {
  if (progress.running) { console.log('[Screener] Already running, skipping.'); return; }
  progress = { running: true, currentSymbol: '', currentIndex: 0, totalSymbols: 0, status: 'Starting...', candidatesFound: 0 };
  console.log('[Screener] Starting screening pipeline...');

  try {
    const watchlist = getWatchlist();
    const dteMin = (getConfig('dte_min') as number) || 21;
    const dteMax = (getConfig('dte_max') as number) || 45;
    const deltaMin = (getConfig('delta_min') as number) || 0.15;
    const deltaMax = (getConfig('delta_max') as number) || 0.30;
    const maxBidAskSpreadPct = (getConfig('max_bid_ask_spread_pct') as number) || 0.10;
    const minOpenInterest = (getConfig('min_open_interest') as number) || 500;
    const ivRankMin = (getConfig('iv_rank_min') as number) || 50;
    const minPremium = (getConfig('min_premium') as number) || 0.50;
    const fromDate = getDateString(dteMin);
    const toDate = getDateString(dteMax);
    const historyBroker = new WebullBroker();

    if (!hasSchwabTokens()) {
      progress.status = 'Schwab not connected. Connect Schwab to run the options screener.';
      console.warn('[Screener] Schwab not connected. Connect Schwab before running the screener.');
      return;
    }

    const chainBroker = new SchwabBroker();

    interface ScoredCandidate {
      symbol: string; strategy: string; strike: number; expiry: string; dte: number;
      premium: number; max_loss: number; pop: number; iv_rank: number; delta: number;
      theta: number; vega: number; bid: number; ask: number; underlying_price: number;
      ai_score: number; ai_flag: string; ai_brief: string; ai_risks: string | null;
      compositeScore: number; spread_long_strike: number | null; collar_put_strike: number | null;
    }

    const allCandidates: ScoredCandidate[] = [];

    progress.totalSymbols = watchlist.length;

    for (let idx = 0; idx < watchlist.length; idx++) {
      const item = watchlist[idx];
      try {
        progress.currentIndex = idx + 1;
        progress.currentSymbol = item.symbol;
        progress.status = `Processing ${item.symbol} (${idx + 1}/${watchlist.length})`;
        console.log(`[Screener] Processing ${item.symbol} (${idx + 1}/${watchlist.length})...`);
        const ivRank = await calculateIVRank(item.symbol, historyBroker);
        if (ivRank < ivRankMin) {
          console.log(`[Screener] ${item.symbol} IV Rank ${ivRank.toFixed(1)} below ${ivRankMin}, skip.`);
          continue;
        }

        const chain = await chainBroker.getOptionsChain(item.symbol, 'PUT', fromDate, toDate);
        const underlyingPrice = chain.underlyingPrice || 0;
        if (!chain.putExpDateMap || underlyingPrice === 0) continue;

        const news = await fetchTickerNews(item.symbol);

        for (const [expiryKey, strikes] of Object.entries(chain.putExpDateMap)) {
          const expiry = expiryKey.split(':')[0];
          for (const [, contracts] of Object.entries(strikes)) {
            for (const contract of contracts) {
              const dte = contract.daysToExpiration;
              const delta = Math.abs(contract.delta || 0);
              const mid = (contract.bid + contract.ask) / 2;
              const bidAskSpread = mid > 0 ? (contract.ask - contract.bid) / mid : 1;

              if (dte < dteMin || dte > dteMax) continue;
              if (delta < deltaMin || delta > deltaMax) continue;
              if (bidAskSpread > maxBidAskSpreadPct) continue;
              if (contract.openInterest < minOpenInterest) continue;
              if (mid < minPremium) continue;

              const maxLoss = (contract.strikePrice - mid) * 100;
              const pop = 1 - delta;

              const analysis = await analyzeCandidate(
                { symbol: item.symbol, underlying_price: underlyingPrice, strategy: 'CSP', strike: contract.strikePrice, expiry, dte, premium: mid, max_loss: maxLoss, pop, iv_rank: ivRank, delta: contract.delta },
                news
              );

              const premiumYield = Math.min(1, mid / (contract.strikePrice * 0.01));
              const compositeScore = pop * 0.4 + (ivRank / 100) * 0.2 + premiumYield * 0.2 + (analysis.score / 100) * 0.2;

              allCandidates.push({
                symbol: item.symbol, strategy: 'CSP', strike: contract.strikePrice, expiry, dte,
                premium: Math.round(mid * 100) / 100, max_loss: Math.round(maxLoss),
                pop: Math.round(pop * 1000) / 1000, iv_rank: Math.round(ivRank * 10) / 10,
                delta: contract.delta, theta: contract.theta || 0, vega: contract.vega || 0,
                bid: contract.bid, ask: contract.ask, underlying_price: underlyingPrice,
                ai_score: analysis.score, ai_flag: analysis.flag, ai_brief: analysis.brief,
                ai_risks: JSON.stringify(analysis.risks), compositeScore,
                spread_long_strike: null, collar_put_strike: null,
              });
            }
          }
        }
      } catch (error) {
        console.error(`[Screener] Error processing ${item.symbol}:`, error);
      }
    }

    progress.status = 'Ranking and saving results...';
    allCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
    const topCandidates = allCandidates.slice(0, 20);
    cleanOldCandidates();
    const now = Math.floor(Date.now() / 1000);
    for (const candidate of topCandidates) {
      insertCandidate({ ...candidate, screened_at: now });
    }
    progress.candidatesFound = topCandidates.length;
    progress.status = `Complete: ${topCandidates.length} candidates found`;
    console.log(`[Screener] Complete: ${topCandidates.length} candidates saved.`);
  } catch (error) {
    progress.status = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('[Screener] Pipeline error:', error);
  } finally {
    progress.running = false;
  }
}
