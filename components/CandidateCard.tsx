'use client';

import type { Candidate } from '@/lib/db';
import { cn } from '@/lib/utils';
import { ShieldAlert, TrendingUp, AlertTriangle, PlusCircle, CheckCircle2 } from 'lucide-react';

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
  const flagBgClass = isGreen ? 'bg-emerald-500/10' : isYellow ? 'bg-amber-500/10' : 'bg-red-500/10';
  const flagBorderClass = isGreen ? 'border-emerald-500/20' : isYellow ? 'border-amber-500/20' : 'border-red-500/20';

  return (
    <div className={cn(
      "group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-zinc-900/40 p-5 backdrop-blur-sm transition-all duration-300 hover:bg-zinc-900/60 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1",
      flagBorderClass
    )}>
      {/* Background Glow */}
      <div className={cn(
        "absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-30",
        isGreen ? 'bg-emerald-500' : isYellow ? 'bg-amber-500' : 'bg-red-500'
      )} />

      <div>
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-white">{candidate.symbol}</h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                {candidate.strategy}
              </span>
              <span className="text-xs font-medium text-zinc-500">${candidate.underlying_price.toFixed(2)}</span>
            </div>
          </div>
          <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 backdrop-blur-md border", flagBgClass, flagBorderClass)}>
            <div className={cn("h-1.5 w-1.5 rounded-full", isGreen ? 'bg-emerald-400' : isYellow ? 'bg-amber-400' : 'bg-red-400')} />
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", flagColorClass)}>
              {candidate.ai_flag}
            </span>
          </div>
        </div>

        {/* Contract Details */}
        <div className="mb-4 flex rounded-lg bg-white/5 p-1 border border-white/5">
          <div className="flex-1 px-3 py-1.5 text-center">
            <div className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">Strike</div>
            <div className="text-sm font-semibold text-white">${candidate.strike.toFixed(2)}</div>
          </div>
          <div className="my-1.5 w-px bg-white/10" />
          <div className="flex-1 px-3 py-1.5 text-center">
            <div className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">Expiry</div>
            <div className="text-sm font-semibold text-zinc-200">{candidate.expiry} <span className="text-[10px] text-zinc-500">({candidate.dte}d)</span></div>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/5 p-2.5 border border-white/5">
            <div className="text-[9px] text-zinc-500 uppercase font-medium">Premium</div>
            <div className="text-base font-bold text-emerald-400">${candidate.premium.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2.5 border border-white/5">
            <div className="text-[9px] text-zinc-500 uppercase font-medium">Max Loss</div>
            <div className="text-base font-bold text-red-400">${candidate.max_loss.toLocaleString()}</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2.5 border border-white/5">
            <div className="text-[9px] text-zinc-500 uppercase font-medium">Prob. Profit</div>
            <div className="text-base font-bold text-zinc-100">{(candidate.pop * 100).toFixed(0)}%</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2.5 border border-white/5">
            <div className="text-[9px] text-zinc-500 uppercase font-medium">IV Rank</div>
            <div className="text-base font-bold text-zinc-100">{candidate.iv_rank.toFixed(1)}</div>
          </div>
        </div>

        {/* Greeks */}
        <div className="mb-4 flex justify-between px-1 text-[10px] font-medium text-zinc-500">
          <span className="flex items-center gap-1">Δ <span className="text-zinc-300">{candidate.delta.toFixed(3)}</span></span>
          <span className="flex items-center gap-1">Θ <span className="text-zinc-300">{candidate.theta.toFixed(4)}</span></span>
          <span className="flex items-center gap-1">ν <span className="text-zinc-300">{candidate.vega.toFixed(3)}</span></span>
        </div>

        {/* AI Analysis */}
        <div className="mb-5 rounded-lg border border-white/5 bg-black/40 p-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-0.5 h-full bg-gradient-to-b from-primary to-indigo-600" />
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">AI Insight</span>
            <span className={cn(
              "text-[11px] font-bold",
              candidate.ai_score > 80 ? "text-emerald-400" : candidate.ai_score > 60 ? "text-amber-400" : "text-red-400"
            )}>{candidate.ai_score.toFixed(0)}/100</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400 italic">"{candidate.ai_brief}"</p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onAddToQueue(candidate.id)}
        disabled={inQueue || disabled}
        className={cn(
          "relative flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all duration-300 overflow-hidden",
          inQueue
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : disabled
            ? "bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed"
            : "bg-gradient-to-r from-primary to-indigo-600 text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0"
        )}
      >
        {inQueue ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Queued
          </>
        ) : (
          <>
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Add to Queue</span>
          </>
        )}
      </button>
    </div>
  );
}
