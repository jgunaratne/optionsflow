import { getConfig, setConfig } from './db';

export interface NewsItem {
  title: string;
  snippet: string;
  url: string;
  published_date: string;
}

interface TavilyResponse {
  results: Array<{ title: string; content: string; url: string; published_date?: string }>;
}

interface CachedNews {
  items: NewsItem[];
  cachedAt: number;
}

const CACHE_TTL = 6 * 60 * 60; // 6 hours

export async function fetchTickerNews(symbol: string): Promise<NewsItem[]> {
  const cacheKey = `news_cache_${symbol}`;
  const cached = getConfig(cacheKey) as CachedNews | undefined;
  const now = Math.floor(Date.now() / 1000);

  if (cached && (now - cached.cachedAt) < CACHE_TTL) return cached.items;

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('[News] TAVILY_API_KEY not set, skipping news fetch');
    return [];
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey, query: `${symbol} stock news earnings risk catalyst`,
        search_depth: 'basic', max_results: 5, days: 7,
      }),
    });

    if (!response.ok) {
      console.error(`[News] Tavily API error: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as TavilyResponse;
    const items: NewsItem[] = (data.results || []).map(r => ({
      title: r.title, snippet: r.content?.slice(0, 200) || '',
      url: r.url, published_date: r.published_date || '',
    }));

    setConfig(cacheKey, { items, cachedAt: now });
    return items;
  } catch (error) {
    console.error('[News] Failed to fetch news:', error);
    return [];
  }
}
