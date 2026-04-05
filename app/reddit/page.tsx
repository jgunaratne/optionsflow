'use client';

import { useEffect, useState } from 'react';
import { useRedditStore } from '@/lib/store';
import type { RedditAnalysis } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Radio, RefreshCw, Loader2, Sparkles, AlertCircle, Newspaper } from 'lucide-react';
import RedditTickerCard from '@/components/RedditTickerCard';
import RedditPostItem from '@/components/RedditPostItem';

const ALL_SUBREDDITS = [
  { id: 'options', label: 'r/options', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { id: 'thetagang', label: 'r/thetagang', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { id: 'wallstreetbets', label: 'r/wsb', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { id: 'stocks', label: 'r/stocks', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { id: 'options_trading', label: 'r/options_trading', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
];

export default function RedditPulsePage() {
  const {
    posts, analysis, activeSubreddits, loading, analyzing, error, lastRefreshed,
    toggleSubreddit, refresh,
  } = useRedditStore();

  const [watchlistSymbols, setWatchlistSymbols] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Load watchlist for cross-referencing
  useEffect(() => {
    fetch('/api/db?table=watchlist')
      .then((res) => res.json())
      .then((data) => {
        const symbols = new Set<string>((data.rows || []).map((r: any) => r.symbol));
        setWatchlistSymbols(symbols);
      })
      .catch(() => {});
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      refresh();
    }
  }, [initialized, refresh]);

  const isRefreshing = loading || analyzing;

  const sortedPosts = [...(posts || [])].sort((a, b) => b.createdUtc - a.createdUtc);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="border-b border-white/10 pb-6 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/20">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Reddit Pulse</h1>
              <p className="text-sm text-zinc-500 mt-0.5">AI-powered stock & options sentiment from Reddit</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-xs text-zinc-500">
                Updated {new Date(lastRefreshed).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => refresh()}
              disabled={isRefreshing}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all shadow-lg shadow-black/40',
                isRefreshing
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-zinc-600 to-zinc-800 text-white hover:from-zinc-500 hover:to-zinc-700',
              )}
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              {analyzing ? 'Analyzing…' : loading ? 'Fetching…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Subreddit pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {ALL_SUBREDDITS.map((sub) => {
            const active = activeSubreddits.includes(sub.id);
            return (
              <button
                key={sub.id}
                onClick={() => toggleSubreddit(sub.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all',
                  active
                    ? sub.color
                    : 'bg-white/5 text-zinc-600 border-white/5 hover:bg-white/10 hover:text-zinc-400',
                )}
              >
                {sub.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-300">Failed to load Reddit data</p>
            <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* AI Summary Card */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/20 backdrop-blur-md shadow-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Gemini Analysis
          </span>
          {analysis && (
            <span className="text-[10px] font-mono text-zinc-600 ml-auto">
              {analysis.postCount} posts across {analysis.subreddits?.length || 0} subreddits
            </span>
          )}
        </div>

        {analyzing ? (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
            <p className="text-sm text-zinc-400">
              Gemini is analyzing Reddit posts from{' '}
              {activeSubreddits.map((s) => `r/${s}`).join(', ')}…
            </p>
          </div>
        ) : analysis?.summary ? (
          <p className="text-sm text-zinc-300 leading-relaxed">{analysis.summary}</p>
        ) : !loading && !error ? (
          <p className="text-sm text-zinc-500">Click Refresh to analyze current Reddit discussions.</p>
        ) : null}
      </div>

      {/* Main content: Ticker Grid + Posts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticker Grid (2/3) */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Trending Tickers
            </span>
            {analysis?.tickers && (
              <span className="text-[10px] font-mono text-zinc-600">
                {analysis.tickers.length} found
              </span>
            )}
          </div>

          {analyzing && !analysis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-zinc-900/20 p-4 animate-pulse">
                  <div className="h-6 w-20 bg-zinc-800 rounded mb-3" />
                  <div className="h-4 w-32 bg-zinc-800 rounded mb-2" />
                  <div className="h-3 w-24 bg-zinc-800/50 rounded" />
                </div>
              ))}
            </div>
          ) : analysis?.tickers && analysis.tickers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {analysis.tickers
                .sort((a, b) => b.mentions - a.mentions)
                .map((ticker) => (
                  <RedditTickerCard
                    key={ticker.symbol}
                    ticker={ticker}
                    isInWatchlist={watchlistSymbols.has(ticker.symbol)}
                  />
                ))}
            </div>
          ) : !loading && !analyzing ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/20 p-8 text-center">
              <Radio className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No ticker data yet. Click Refresh to start.</p>
            </div>
          ) : null}
        </div>

        {/* Posts Feed (1/3) */}
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Recent Posts
            </span>
            {posts.length > 0 && (
              <span className="text-[10px] font-mono text-zinc-600">
                {posts.length}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/20 backdrop-blur-md shadow-xl overflow-hidden">
            {loading && posts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
              </div>
            ) : sortedPosts.length > 0 ? (
              <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
                {sortedPosts.slice(0, 50).map((post) => (
                  <RedditPostItem key={post.id} post={post} />
                ))}
              </div>
            ) : !loading ? (
              <div className="p-6 text-center">
                <p className="text-sm text-zinc-500">No posts loaded yet.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
