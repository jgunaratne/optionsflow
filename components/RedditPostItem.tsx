'use client';

import { cn } from '@/lib/utils';
import { ArrowUp, MessageSquare, ExternalLink } from 'lucide-react';
import type { RedditPost } from '@/lib/reddit';

const subredditColors: Record<string, string> = {
  options: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  thetagang: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  wallstreetbets: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  stocks: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  options_trading: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

function formatRelativeTime(utcSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - utcSeconds;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function formatScore(score: number): string {
  if (score >= 10000) return `${(score / 1000).toFixed(0)}k`;
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`;
  return String(score);
}

// Highlight ticker symbols in post titles
function highlightTickers(title: string): React.ReactNode[] {
  const tickerRegex = /\$?([A-Z]{2,5})\b/g;
  const knownTickers = new Set([
    'SPY','QQQ','IWM','AAPL','MSFT','NVDA','AMZN','GOOGL','GOOG','META',
    'TSLA','AMD','INTC','NFLX','DIS','BA','PYPL','SQ','PLTR','SOFI',
    'NIO','BABA','COIN','GME','AMC','RIVN','LCID','HOOD','MARA','RIOT',
    'XOM','CVX','JPM','BAC','GS','WFC','V','MA','UNH','JNJ','PFE',
    'MRNA','LLY','ABBV','MRK','PG','KO','PEP','COST','WMT','HD',
  ]);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = tickerRegex.exec(title)) !== null) {
    const symbol = match[1];
    if (!knownTickers.has(symbol)) continue;

    if (match.index > lastIndex) {
      parts.push(title.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="text-cyan-400 font-mono font-semibold">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < title.length) {
    parts.push(title.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [title];
}

interface Props {
  post: RedditPost;
}

export default function RedditPostItem({ post }: Props) {
  const colorClass = subredditColors[post.subreddit] || 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';

  return (
    <div className="flex items-start gap-3 p-3 border-b border-white/5 hover:bg-white/5 transition-colors group">
      {/* Subreddit badge */}
      <span className={cn('shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-full border px-2 py-0.5 mt-0.5', colorClass)}>
        r/{post.subreddit}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 leading-snug mb-1">
          {highlightTickers(post.title)}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="text-zinc-600">u/{post.author}</span>
          <span className="flex items-center gap-0.5">
            <ArrowUp className="h-3 w-3" />
            {formatScore(post.score)}
          </span>
          <span className="flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" />
            {post.numComments}
          </span>
          <span>{formatRelativeTime(post.createdUtc)}</span>
          {post.linkFlairText && (
            <span className="bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">
              {post.linkFlairText}
            </span>
          )}
        </div>
      </div>

      {/* External link */}
      <a
        href={post.permalink}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
