import { getConfig, setConfig, insertCandidate, cleanOldCandidates } from './db';
import { analyzeCandidatesBatch } from './ai';
import { fetchTickerNews } from './news';
import type { Broker, OptionContract } from './broker';
import { SchwabBroker, hasSchwabTokens } from './schwab';
import { WebullBroker } from './webull';
import { consumeScreenerUniverseSummary } from './screener-universe';

interface IVRankCache { ivRank: number; cachedAt: number; }

interface ScreenerLogEntry {
  time: number;
  symbol: string;
  message: string;
  type: 'info' | 'skip' | 'found' | 'error';
}

interface ScreenerProgress {
  running: boolean;
  currentSymbol: string;
  currentIndex: number;
  totalSymbols: number;
  status: string;
  candidatesFound: number;
  logs: ScreenerLogEntry[];
}

let progress: ScreenerProgress = {
  running: false, currentSymbol: '', currentIndex: 0,
  totalSymbols: 0, status: 'idle', candidatesFound: 0, logs: [],
};

export function isScreenerRunning(): boolean {
  return progress.running;
}

export function getScreenerProgress(): ScreenerProgress {
  return { ...progress, logs: [...progress.logs] };
}

function logActivity(symbol: string, message: string, type: ScreenerLogEntry['type'] = 'info') {
  progress.logs.push({ time: Date.now(), symbol, message, type });
  // Keep only last 50 entries
  if (progress.logs.length > 50) progress.logs = progress.logs.slice(-50);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function runScreener(): Promise<void> {
  if (progress.running) { console.log('[Screener] Already running, skipping.'); return; }
  progress = { running: true, currentSymbol: '', currentIndex: 0, totalSymbols: 0, status: 'Starting...', candidatesFound: 0, logs: [] };
  logActivity('', 'Screener pipeline starting...', 'info');
  console.log('[Screener] Starting screening pipeline...');

  try {
    const universe = await consumeScreenerUniverseSummary();
    const watchlist = universe.symbols.map((symbol) => ({ symbol }));
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

    logActivity('', `Scanning ${universe.summary} (DTE ${dteMin}-${dteMax}, Δ ${deltaMin}-${deltaMax})`, 'info');

    if (!hasSchwabTokens()) {
      progress.status = 'Schwab not connected. Connect Schwab to run the options screener.';
      logActivity('', 'Schwab not connected — cannot run screener', 'error');
      console.warn('[Screener] Schwab not connected. Connect Schwab before running the screener.');
      return;
    }

    const chainBroker = new SchwabBroker();

    interface ScoredCandidate {
      symbol: string; strategy: string; strike: number; expiry: string; dte: number;
      premium: number; max_loss: number; pop: number; iv_rank: number; delta: number;
      theta: number; vega: number; bid: number; ask: number; underlying_price: number;
      ai_score: number; ai_flag: string; ai_brief: string; ai_risks: string | null;
      compositeScore: number; is_eligible: number; rejection_reason: string | null;
      spread_long_strike: number | null; collar_put_strike: number | null;
    }

    const allCandidates: ScoredCandidate[] = [];

    progress.totalSymbols = watchlist.length;

    for (let idx = 0; idx < watchlist.length; idx++) {
      const item = watchlist[idx];
      try {
        progress.currentIndex = idx + 1;
        progress.currentSymbol = item.symbol;
        progress.status = `Processing ${item.symbol} (${idx + 1}/${watchlist.length})`;
        logActivity(item.symbol, `Calculating IV Rank...`, 'info');
        console.log(`[Screener] Processing ${item.symbol} (${idx + 1}/${watchlist.length})...`);
        const ivRank = await calculateIVRank(item.symbol, historyBroker);
        const ivRankRejected = ivRank < ivRankMin;
        if (ivRankRejected) {
          logActivity(item.symbol, `IV Rank ${ivRank.toFixed(1)}% — below ${ivRankMin}% threshold`, 'skip');
        }

        logActivity(item.symbol, `IV Rank ${ivRank.toFixed(1)}% — fetching options chain...`, 'info');
        const chain = await chainBroker.getOptionsChain(item.symbol, 'PUT', fromDate, toDate);
        const underlyingPrice = chain.underlyingPrice || 0;
        if (!chain.putExpDateMap || underlyingPrice === 0) {
          logActivity(item.symbol, `No put options data available, skipped`, 'skip');
          continue;
        }

        logActivity(item.symbol, `Chain loaded ($${underlyingPrice.toFixed(2)}) — analyzing contracts...`, 'info');
        const news = await fetchTickerNews(item.symbol);
        let symbolCandidates = 0;
        const eligibleContracts: Array<{
          contract: OptionContract;
          expiry: string;
          dte: number;
          mid: number;
          maxLoss: number;
          pop: number;
        }> = [];

        for (const [expiryKey, strikes] of Object.entries(chain.putExpDateMap)) {
          const expiry = expiryKey.split(':')[0];
          for (const [, contracts] of Object.entries(strikes)) {
            for (const contract of contracts) {
              const dte = contract.daysToExpiration;
              const delta = Math.abs(contract.delta || 0);
              const mid = (contract.bid + contract.ask) / 2;
              const bidAskSpread = mid > 0 ? (contract.ask - contract.bid) / mid : 1;
              const maxLoss = (contract.strikePrice - mid) * 100;
              const pop = 1 - delta;
              const rejectionReasons: string[] = [];
              if (ivRankRejected) rejectionReasons.push(`IV Rank ${ivRank.toFixed(1)} below ${ivRankMin}`);
              if (dte < dteMin || dte > dteMax) rejectionReasons.push(`DTE ${dte} outside ${dteMin}-${dteMax}`);
              if (delta < deltaMin || delta > deltaMax) rejectionReasons.push(`Delta ${delta.toFixed(3)} outside ${deltaMin}-${deltaMax}`);
              if (bidAskSpread > maxBidAskSpreadPct) rejectionReasons.push(`Bid/ask spread ${(bidAskSpread * 100).toFixed(1)}% too wide`);
              if (contract.openInterest < minOpenInterest) rejectionReasons.push(`Open interest ${contract.openInterest} below ${minOpenInterest}`);
              if (mid < minPremium) rejectionReasons.push(`Premium ${mid.toFixed(2)} below ${minPremium.toFixed(2)}`);

              const isEligible = rejectionReasons.length === 0;
              const aiScore = 0;
              const aiFlag = 'GRAY';
              const aiBrief = rejectionReasons.join(' • ') || 'Passed screening';
              const aiRisks: string | null = null;
              const compositeScore = -1;

              if (isEligible) {
                eligibleContracts.push({ contract, expiry, dte, mid, maxLoss, pop });
              }

              allCandidates.push({
                symbol: item.symbol, strategy: 'CSP', strike: contract.strikePrice, expiry, dte,
                premium: Math.round(mid * 100) / 100, max_loss: Math.round(maxLoss),
                pop: Math.round(pop * 1000) / 1000, iv_rank: Math.round(ivRank * 10) / 10,
                delta: contract.delta, theta: contract.theta || 0, vega: contract.vega || 0,
                bid: contract.bid, ask: contract.ask, underlying_price: underlyingPrice,
                ai_score: aiScore, ai_flag: aiFlag, ai_brief: aiBrief,
                ai_risks: aiRisks, compositeScore, is_eligible: isEligible ? 1 : 0,
                rejection_reason: isEligible ? null : rejectionReasons.join(' • '),
                spread_long_strike: null, collar_put_strike: null,
              });
            }
          }
        }

        if (eligibleContracts.length > 0) {
          logActivity(item.symbol, `Submitting ${eligibleContracts.length} contract${eligibleContracts.length > 1 ? 's' : ''} for AI review...`, 'info');
          const analyses = await analyzeCandidatesBatch(
            eligibleContracts.map(({ contract, expiry, dte, mid, maxLoss, pop }) => ({
              symbol: item.symbol,
              underlying_price: underlyingPrice,
              strategy: 'CSP',
              strike: contract.strikePrice,
              expiry,
              dte,
              premium: mid,
              max_loss: maxLoss,
              pop,
              iv_rank: ivRank,
              delta: contract.delta,
            })),
            news
          );

          let analysisIndex = 0;
          for (const candidate of allCandidates) {
            if (candidate.symbol !== item.symbol || candidate.is_eligible !== 1 || candidate.ai_flag !== 'GRAY') continue;
            const analysis = analyses[analysisIndex++];
            const premiumYield = Math.min(1, candidate.premium / Math.max(0.01, candidate.strike * 0.008));
            const safetyBuffer = candidate.underlying_price > 0
              ? clamp(((candidate.underlying_price - candidate.strike) / candidate.underlying_price) / 0.15, 0, 1)
              : 0;
            const deltaSafety = 1 - clamp(Math.abs(Math.abs(candidate.delta) - 0.15) / 0.10, 0, 1);
            candidate.ai_score = analysis.score;
            candidate.ai_flag = analysis.flag;
            candidate.ai_brief = analysis.brief;
            candidate.ai_risks = JSON.stringify(analysis.risks);
            candidate.compositeScore =
              candidate.pop * 0.40 +
              safetyBuffer * 0.25 +
              deltaSafety * 0.15 +
              premiumYield * 0.10 +
              (analysis.score / 100) * 0.10;
            symbolCandidates++;
          }
        }

        if (symbolCandidates > 0) {
          logActivity(item.symbol, `Found ${symbolCandidates} candidate${symbolCandidates > 1 ? 's' : ''}`, 'found');
        } else {
          logActivity(item.symbol, `No contracts passed filters`, 'skip');
        }
        await sleep(250);
      } catch (error) {
        logActivity(item.symbol, `Error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
        console.error(`[Screener] Error processing ${item.symbol}:`, error);
        await sleep(500);
      }
    }

    progress.status = 'Ranking and saving results...';
    logActivity('', `Saving ${allCandidates.length} screened contracts...`, 'info');
    allCandidates.sort((a, b) => {
      if (a.is_eligible !== b.is_eligible) return b.is_eligible - a.is_eligible;
      return b.compositeScore - a.compositeScore;
    });
    cleanOldCandidates();
    const now = Math.floor(Date.now() / 1000);
    for (const candidate of allCandidates) {
      insertCandidate({ ...candidate, screened_at: now });
    }
    const eligibleCount = allCandidates.filter((candidate) => candidate.is_eligible === 1).length;
    progress.candidatesFound = eligibleCount;
    progress.status = `Complete: ${eligibleCount} eligible of ${allCandidates.length} screened`;
    logActivity('', `✅ Complete — ${eligibleCount} eligible, ${allCandidates.length - eligibleCount} rejected`, 'found');
    console.log(`[Screener] Complete: ${eligibleCount} eligible, ${allCandidates.length - eligibleCount} rejected.`);
  } catch (error) {
    progress.status = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logActivity('', `Pipeline error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
    console.error('[Screener] Pipeline error:', error);
  } finally {
    progress.running = false;
  }
}
