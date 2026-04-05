'use client';

import type { Candidate } from '@/lib/db';
import { cn } from '@/lib/utils';
import { PlusCircle, CheckCircle2 } from 'lucide-react';

interface CandidateCardProps {
  candidate: Candidate;
  onAddToQueue: (id: number) => void;
  inQueue?: boolean;
  disabled?: boolean;
}

export default function CandidateCard({ candidate, onAddToQueue, inQueue, disabled }: CandidateCardProps) {
  const isGreen = candidate.ai_flag === 'GREEN';
  const isYellow = candidate.ai_flag === 'YELLOW';
  
  const flagColorClass = isGreen ? 'text-emerald-400' : isYellow ? 'text-amber-400' : 'text-red-400';
  const flagBgClass = isGreen ? 'bg-emerald-900/30' : isYellow ? 'bg-amber-900/30' : 'bg-red-900/30';
  const flagBorderClass = isGreen ? 'border-emerald-500/30' : isYellow ? 'border-amber-500/30' : 'border-red-500/30';

  return (
    <div className={cn(
      "group relative flex flex-col justify-between overflow-hidden rounded-md border bg-zinc-900/60 p-5 backdrop-blur-sm transition-all duration-300 hover:bg-zinc-800/80 hover:shadow-xl hover:shadow-black/60 hover:-translate-y-1 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-black",
      flagBorderClass
    )}>
      {/* Background Glow */}
      <div className={cn(
        "absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40",
        isGreen ? 'bg-emerald-500' : isYellow ? 'bg-amber-500' : 'bg-red-500'
      )} aria-hidden="true" />

      <div>
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight text-white">{candidate.symbol}</h3>
            <div className="mt-1 flex items-center gap-3">
              <span className="rounded-md bg-white/10 border border-white/20 px-2 py-0.5 text-xs font-bold text-zinc-300">
                {candidate.strategy}
              </span>
              <span className="text-sm font-semibold text-zinc-400">${candidate.underlying_price.toFixed(2)}</span>
            </div>
          </div>
          <div className={cn("flex items-center gap-2 rounded px-3 py-1 backdrop-blur-md border", flagBgClass, flagBorderClass)}>
            <div className={cn("h-2 w-2 rounded-full", isGreen ? 'bg-emerald-400' : isYellow ? 'bg-amber-400' : 'bg-red-400')} aria-hidden="true" />
            <span className={cn("text-xs font-bold uppercase tracking-wider", flagColorClass)}>
              {candidate.ai_flag}
            </span>
          </div>
        </div>

        {/* Contract Details */}
        <div className="mb-5 flex rounded bg-zinc-950/50 p-1 border border-white/10">
          <div className="flex-1 px-3 py-2 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Strike</div>
            <div className="text-base font-bold text-white">${candidate.strike.toFixed(2)}</div>
          </div>
          <div className="my-2 w-px bg-white/20" />
          <div className="flex-1 px-3 py-2 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Expiry</div>
            <div className="text-base font-bold text-zinc-200">{candidate.expiry} <span className="text-[11px] text-zinc-500">({candidate.dte}d)</span></div>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded bg-zinc-950/50 p-3 border border-white/10">
            <div className="text-xs text-zinc-400 uppercase font-bold tracking-tight">Premium</div>
            <div className="text-lg font-extrabold text-emerald-400">${candidate.premium.toFixed(2)}</div>
          </div>
          <div className="rounded bg-zinc-950/50 p-3 border border-white/10">
            <div className="text-xs text-zinc-400 uppercase font-bold tracking-tight">Max Loss</div>
            <div className="text-lg font-extrabold text-red-400">${candidate.max_loss.toLocaleString()}</div>
          </div>
          <div className="rounded bg-zinc-950/50 p-3 border border-white/10">
            <div className="text-xs text-zinc-400 uppercase font-bold tracking-tight">Prob. Profit</div>
            <div className="text-lg font-extrabold text-zinc-100">{(candidate.pop * 100).toFixed(0)}%</div>
          </div>
          <div className="rounded bg-zinc-950/50 p-3 border border-white/10">
            <div className="text-xs text-zinc-400 uppercase font-bold tracking-tight">IV Rank</div>
            <div className="text-lg font-extrabold text-zinc-100">{candidate.iv_rank.toFixed(1)}</div>
          </div>
        </div>

        {/* Greeks */}
        <div className="mb-5 flex justify-between px-2 text-xs font-semibold text-zinc-400" aria-label="Greeks">
          <span className="flex items-center gap-1">Δ <span className="text-zinc-200">{candidate.delta.toFixed(3)}</span></span>
          <span className="flex items-center gap-1">Θ <span className="text-zinc-200">{candidate.theta.toFixed(4)}</span></span>
          <span className="flex items-center gap-1">ν <span className="text-zinc-200">{candidate.vega.toFixed(3)}</span></span>
        </div>

        {/* AI Analysis */}
        <div className="mb-6 rounded border border-white/10 bg-zinc-950/50 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-indigo-500" aria-hidden="true" />
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">AI Insight</span>
            <span className={cn(
              "text-sm font-black",
              candidate.ai_score > 80 ? "text-emerald-400" : candidate.ai_score > 60 ? "text-amber-400" : "text-red-400"
            )}>{candidate.ai_score.toFixed(0)}/100</span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">&quot;{candidate.ai_brief}&quot;</p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onAddToQueue(candidate.id)}
        disabled={inQueue || disabled}
        aria-label={inQueue ? `Remove ${candidate.symbol} from queue` : `Add ${candidate.symbol} to queue`}
        className={cn(
          "relative flex w-full items-center justify-center gap-2 rounded py-3 text-sm font-bold transition-all duration-300 overflow-hidden focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black",
          inQueue
            ? "bg-emerald-900/40 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-900/60"
            : disabled
            ? "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
            : "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/50 hover:-translate-y-0.5 active:translate-y-0"
        )}
      >
        {inQueue ? (
          <>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Queued
          </>
        ) : (
          <>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            <span>Add to Queue</span>
          </>
        )}
      </button>
    </div>
  );
}
