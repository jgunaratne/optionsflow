'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RedditTickerAnalysis } from '@/lib/store';

const sentimentConfig = {
  bullish: { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', border: 'border-l-emerald-500', icon: TrendingUp, label: 'Bullish' },
  bearish: { color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', border: 'border-l-red-500', icon: TrendingDown, label: 'Bearish' },
  neutral: { color: 'text-zinc-400', bg: 'bg-zinc-500/15 border-zinc-500/30', border: 'border-l-zinc-500', icon: Minus, label: 'Neutral' },
};

interface Props {
  ticker: RedditTickerAnalysis;
  isInWatchlist: boolean;
}

export default function RedditTickerCard({ ticker, isInWatchlist }: Props) {
  const [expanded, setExpanded] = useState(false);
  const config = sentimentConfig[ticker.sentiment] || sentimentConfig.neutral;
  const SentimentIcon = config.icon;

  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-zinc-900/20 backdrop-blur-md shadow-xl overflow-hidden transition-all duration-200 hover:bg-white/5 cursor-pointer border-l-[3px]',
        config.border,
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4">
        {/* Top row: Symbol + Sentiment */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white font-mono tracking-tight">
              {ticker.symbol}
            </span>
            {isInWatchlist && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Watchlist
              </span>
            )}
          </div>
          <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', config.bg)}>
            <SentimentIcon className={cn('h-3.5 w-3.5', config.color)} />
            <span className={config.color}>{config.label}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Mentions</span>
            <p className="text-lg font-bold text-white font-mono">{ticker.mentions}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Avg Score</span>
            <p className="text-lg font-bold text-zinc-300 font-mono">{Math.round(ticker.avgScore)}</p>
          </div>
        </div>

        {/* Trade ideas */}
        {ticker.tradeIdeas.length > 0 && (
          <div className="mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Top Trade Idea</span>
            <p className="text-sm text-cyan-400 font-mono mt-0.5">{ticker.tradeIdeas[0]}</p>
          </div>
        )}

        {/* Strategy pills */}
        {ticker.strategies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ticker.strategies.map((strategy) => (
              <span
                key={strategy}
                className="bg-white/10 text-zinc-300 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              >
                {strategy}
              </span>
            ))}
          </div>
        )}

        {/* Expand indicator */}
        {ticker.topPosts.length > 0 && (
          <div className="flex justify-center mt-2">
            <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition-transform', expanded && 'rotate-180')} />
          </div>
        )}
      </div>

      {/* Expanded: Top Posts */}
      <AnimatePresence>
        {expanded && ticker.topPosts.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5 px-4 py-3 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Source Posts</span>
              {ticker.topPosts.map((post, i) => (
                <div key={i} className="flex items-start justify-between gap-2 group">
                  <p className="text-xs text-zinc-300 leading-snug flex-1">{post.title}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-zinc-500 font-mono">▲ {post.score}</span>
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
