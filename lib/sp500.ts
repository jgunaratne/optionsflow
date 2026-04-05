import { getConfig, setConfig } from './db';

const WIKIPEDIA_SP500_URL = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';
const SP500_CACHE_KEY = 'sp500_symbols_cache';
const SP500_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

interface SymbolCache {
  symbols: string[];
  cachedAt: number;
}

function normalizeSymbol(symbol: string): string {
  return symbol.replace(/\./g, '/').trim();
}

function parseSymbolsFromHtml(html: string): string[] {
  const tableMatch = html.match(/<table class="wikitable sortable[^"]*" id="constituents">([\s\S]*?)<\/table>/i);
  if (!tableMatch) throw new Error('Failed to locate S&P 500 constituents table');

  const rows = tableMatch[1].match(/<tr>[\s\S]*?<\/tr>/g) || [];
  const symbols: string[] = [];

  for (const row of rows) {
    const symbolMatch = row.match(/<td><a [^>]*>([^<]+)<\/a><\/td>/i);
    if (!symbolMatch) continue;
    const symbol = normalizeSymbol(symbolMatch[1]);
    if (symbol) symbols.push(symbol);
  }

  if (symbols.length < 450) {
    throw new Error(`Parsed only ${symbols.length} S&P symbols; refusing to use incomplete list`);
  }

  return symbols;
}

export async function getSP500Symbols(): Promise<string[]> {
  const now = Math.floor(Date.now() / 1000);
  const cached = getConfig(SP500_CACHE_KEY) as SymbolCache | undefined;

  if (cached && Array.isArray(cached.symbols) && cached.symbols.length >= 450 && (now - cached.cachedAt) < SP500_CACHE_TTL_SECONDS) {
    return cached.symbols;
  }

  const response = await fetch(WIKIPEDIA_SP500_URL, {
    headers: { 'User-Agent': 'OptionsFlow/1.0 (SP500 screener cache refresh)' },
    next: { revalidate: SP500_CACHE_TTL_SECONDS },
  });

  if (!response.ok) {
    if (cached?.symbols?.length) return cached.symbols;
    throw new Error(`Failed to fetch S&P 500 constituents: HTTP ${response.status}`);
  }

  const html = await response.text();
  const symbols = parseSymbolsFromHtml(html);
  setConfig(SP500_CACHE_KEY, { symbols, cachedAt: now });
  return symbols;
}
