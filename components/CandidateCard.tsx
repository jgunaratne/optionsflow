'use client';

import type { Candidate } from '@/lib/db';
import { cn } from '@/lib/utils';

interface CandidateCardProps {
  candidate: Candidate;
  onAddToQueue: (id: number) => void;
  inQueue?: boolean;
  disabled?: boolean;
}

export default function CandidateCard({ candidate, onAddToQueue, inQueue, disabled }: CandidateCardProps) {
  const isGreen = candidate.ai_flag === 'GREEN';
  const isYellow = candidate.ai_flag === 'YELLOW';
  
  const flagColorClass = isGreen ? 'terminal-green' : isYellow ? 'terminal-amber' : 'terminal-red';
  const flagBorderClass = isGreen ? 'terminal-border-green' : isYellow ? 'border-amber-500/30' : 'terminal-border-red';

  return (
    <div className={cn(
      "relative border bg-black p-4 transition-colors hover:bg-zinc-900/30",
      flagBorderClass
    )}>
      {/* Symbol + Price */}
      <div className="mb-3 flex items-center justify-between border-b border-zinc-800/60 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-white tracking-tight">{candidate.symbol}</span>
          <span className="text-[10px] bg-zinc-900 px-1.5 py-0.5 text-zinc-400 rounded-sm border border-zinc-800/60">{candidate.strategy}</span>
        </div>
        <div className="text-right">
          <div className="text-sm text-zinc-100">${candidate.underlying_price.toFixed(2)}</div>
        </div>
      </div>

      {/* Contract Details */}
      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs leading-tight text-zinc-500">
        <div className="flex justify-between">
          <span>Strike</span>
          <span className="text-zinc-200">${candidate.strike.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Expiry</span>
          <span className="text-zinc-200">{candidate.expiry}</span>
        </div>
        <div className="flex justify-between">
          <span>DTE</span>
          <span className="text-zinc-200">{candidate.dte}d</span>
        </div>
        <div className="flex justify-between">
          <span>IV Rank</span>
          <span className="text-zinc-200">{candidate.iv_rank.toFixed(1)}</span>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="mb-3 grid grid-cols-3 gap-1 border-y border-zinc-800/60 py-2">
        <div className="text-center">
          <div className="text-[10px] text-zinc-600">Premium</div>
          <div className="text-sm terminal-green">${candidate.premium.toFixed(2)}</div>
        </div>
        <div className="text-center border-x border-zinc-800/60">
          <div className="text-[10px] text-zinc-600">POP</div>
          <div className="text-sm text-zinc-200">{(candidate.pop * 100).toFixed(0)}%</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-zinc-600">Risk</div>
          <div className="text-sm terminal-red">${candidate.max_loss.toLocaleString()}</div>
        </div>
      </div>

      {/* Greeks (Condensed) */}
      <div className="mb-3 flex justify-between px-1 text-[10px] text-zinc-500">
        <span>Δ <span className="text-zinc-300">{candidate.delta.toFixed(3)}</span></span>
        <span>Θ <span className="text-zinc-300">{candidate.theta.toFixed(4)}</span></span>
        <span>ν <span className="text-zinc-300">{candidate.vega.toFixed(3)}</span></span>
      </div>

      {/* AI Box */}
      <div className="mb-3 border border-zinc-800/60 bg-zinc-900/20 p-2.5 text-xs">
        <div className="mb-1.5 flex items-center justify-between border-b border-zinc-800/60 pb-1">
          <span className="text-zinc-500">AI Score</span>
          <span className={cn("font-medium", flagColorClass)}>{candidate.ai_score.toFixed(0)}</span>
        </div>
        <p className="line-clamp-2 leading-snug text-zinc-400 italic">"{candidate.ai_brief}"</p>
      </div>

      {/* Compact Add Button */}
      <button
        onClick={() => onAddToQueue(candidate.id)}
        disabled={inQueue || disabled}
        className={cn(
          "w-full border py-2 text-xs transition-all rounded-sm",
          inQueue
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500"
            : disabled
            ? "border-zinc-800 bg-zinc-900/50 text-zinc-600"
            : "border-primary/50 bg-primary/10 text-primary hover:bg-primary hover:text-black"
        )}
      >
        {inQueue ? 'Queued ✓' : 'Add to queue'}
      </button>
    </div>
  );
}
