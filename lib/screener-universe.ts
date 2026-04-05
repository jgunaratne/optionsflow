import { getConfig, getWatchlist, setConfig } from './db';
import { getSP500Symbols } from './sp500';

export interface ScreenerUniverseSummary {
  mode: 'watchlist' | 'sp500';
  symbols: string[];
  totalAvailable: number;
  batchSize: number | null;
  startIndex: number | null;
  summary: string;
}

export async function getScreenerUniverseSummary(): Promise<ScreenerUniverseSummary> {
  const screenerUniverse = ((getConfig('screener_universe') as string) || 'watchlist') === 'sp500' ? 'sp500' : 'watchlist';

  if (screenerUniverse === 'watchlist') {
    const watchlist = getWatchlist().map((item) => item.symbol);
    return {
      mode: 'watchlist',
      symbols: watchlist,
      totalAvailable: watchlist.length,
      batchSize: null,
      startIndex: null,
      summary: `${watchlist.length} watchlist symbols`,
    };
  }

  const allSymbols = await getSP500Symbols();
  const batchSize = Math.max(25, Math.min(100, Math.round((getConfig('sp500_batch_size') as number) || 50)));
  const cursor = Math.max(0, Math.round((getConfig('sp500_cursor') as number) || 0));
  const normalizedCursor = allSymbols.length > 0 ? cursor % allSymbols.length : 0;
  const symbols = Array.from({ length: Math.min(batchSize, allSymbols.length) }, (_, index) => allSymbols[(normalizedCursor + index) % allSymbols.length]);

  return {
    mode: 'sp500',
    symbols,
    totalAvailable: allSymbols.length,
    batchSize: symbols.length,
    startIndex: normalizedCursor,
    summary: `next ${symbols.length} of ${allSymbols.length} S&P symbols`,
  };
}

export async function consumeScreenerUniverseSummary(): Promise<ScreenerUniverseSummary> {
  const summary = await getScreenerUniverseSummary();
  if (summary.mode === 'sp500' && summary.totalAvailable > 0 && summary.batchSize) {
    setConfig('sp500_cursor', ((summary.startIndex || 0) + summary.batchSize) % summary.totalAvailable);
  }
  return summary;
}
