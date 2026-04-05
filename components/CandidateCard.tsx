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
  const isRejected = candidate.is_eligible === 0;
  const isGreen = candidate.ai_flag === 'GREEN';
  const isYellow = candidate.ai_flag === 'YELLOW';
  const recommendationLabel = isRejected ? 'Skip' : isGreen ? 'Best Pick' : isYellow ? 'Maybe' : 'Risky';
  
  const flagColorClass = isRejected ? 'text-zinc-500' : isGreen ? 'text-emerald-400' : isYellow ? 'text-amber-400' : 'text-red-400';
  const flagBgClass = isRejected ? 'bg-zinc-800/40' : isGreen ? 'bg-emerald-500/10' : isYellow ? 'bg-amber-500/10' : 'bg-red-500/10';
  const flagBorderClass = isRejected ? 'border-zinc-800' : isGreen ? 'border-emerald-500/20' : isYellow ? 'border-amber-500/20' : 'border-red-500/20';

  return (
    <div className={cn(
      "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/40 p-5 transition-all duration-300",
      isRejected ? "opacity-60" : "hover:border-white/10 hover:bg-zinc-900/60"
    )}>
      <div>
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight text-white">{candidate.symbol}</h3>
              <span className="text-xs font-medium text-zinc-500">${candidate.underlying_price.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {candidate.strategy}
              </span>
            </div>
          </div>
          <div className={cn("flex items-center gap-1.5 rounded-full border px-2 py-0.5", flagBgClass, flagBorderClass)}>
            <div className={cn("h-1.5 w-1.5 rounded-full", isRejected ? 'bg-zinc-500' : isGreen ? 'bg-emerald-400' : isYellow ? 'bg-amber-400' : 'bg-red-400')} aria-hidden="true" />
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", flagColorClass)}>
              {recommendationLabel}
            </span>
          </div>
        </div>

        {/* Contract Summary */}
        <div className="mb-6 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">${candidate.strike.toFixed(2)}</span>
          <span className="text-sm font-medium text-zinc-500">put</span>
          <span className="text-sm font-medium text-zinc-500">•</span>
          <span className="text-sm font-medium text-zinc-500">{candidate.expiry}</span>
        </div>

        {/* Metrics Grid */}
        <div className="mb-6 grid grid-cols-2 gap-y-4 gap-x-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Premium</div>
            <div className="text-sm font-bold text-emerald-400">${candidate.premium.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Max Risk</div>
            <div className="text-sm font-bold text-zinc-200">${candidate.max_loss.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Win Chance</div>
            <div className="text-sm font-bold text-zinc-200">{(candidate.pop * 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Hype (IVR)</div>
            <div className="text-sm font-bold text-zinc-200">{candidate.iv_rank.toFixed(1)}</div>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="mb-6 border-t border-white/5 pt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">AI Insight</span>
            <span className={cn(
              "text-[10px] font-black",
              candidate.ai_score > 80 ? "text-emerald-400" : candidate.ai_score > 60 ? "text-amber-400" : "text-red-400"
            )}>{candidate.ai_score.toFixed(0)}/100</span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-400 line-clamp-3">{candidate.ai_brief}</p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onAddToQueue(candidate.id)}
        disabled={inQueue || disabled || isRejected}
        className={cn(
          "w-full rounded-xl py-2.5 text-xs font-bold transition-all duration-200",
          inQueue
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : isRejected
            ? "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
            : "bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98]"
        )}
      >
        {inQueue ? 'Queued' : isRejected ? 'Skip' : 'Add to Queue'}
      </button>
    </div>
  );
}
