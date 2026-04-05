'use client';

import type { Candidate } from '@/lib/db';
import { ShieldAlert, TrendingUp, AlertTriangle, Info, PlusCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CandidateCardProps {
  candidate: Candidate;
  onAddToQueue: (id: number) => void;
  inQueue?: boolean;
  disabled?: boolean;
}

export default function CandidateCard({ candidate, onAddToQueue, inQueue, disabled }: CandidateCardProps) {
  const flagStyle = candidate.ai_flag === 'GREEN'
    ? { icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, border: 'border-emerald-500/20', bg: 'bg-emerald-500/10' }
    : candidate.ai_flag === 'YELLOW'
    ? { icon: <AlertTriangle className="h-4 w-4 text-amber-400" />, border: 'border-amber-500/20', bg: 'bg-amber-500/10' }
    : { icon: <ShieldAlert className="h-4 w-4 text-red-400" />, border: 'border-red-500/20', bg: 'bg-red-500/10' };

  const strategyColors: Record<string, string> = {
    CSP: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    CC: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    BULL_PUT_SPREAD: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    COLLAR: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };

  const risks = candidate.ai_risks ? JSON.parse(candidate.ai_risks) as string[] : [];

  return (
    <div className={cn(
      "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-black/40 p-5 backdrop-blur-md transition-all duration-300 hover:bg-black/60 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1",
      flagStyle.border
    )}>
      {/* Background Glow */}
      <div className={cn(
        "absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-30",
        candidate.ai_flag === 'GREEN' ? 'bg-emerald-500' : candidate.ai_flag === 'YELLOW' ? 'bg-amber-500' : 'bg-red-500'
      )} />

      <div>
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-white">{candidate.symbol}</h3>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", strategyColors[candidate.strategy] || 'bg-white/5 text-zinc-400 border-white/10')}>
                {candidate.strategy}
              </span>
              <span className="text-xs font-medium text-zinc-400">${candidate.underlying_price.toFixed(2)}</span>
            </div>
          </div>
          <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 backdrop-blur-md", flagStyle.bg, flagStyle.border)}>
            {flagStyle.icon}
            <span className="text-xs font-bold uppercase tracking-wider text-white/90">
              {candidate.ai_flag}
            </span>
          </div>
        </div>

        {/* Strike + Expiry */}
        <div className="mb-5 flex rounded-xl bg-white/5 p-1 backdrop-blur-sm border border-white/5">
          <div className="flex-1 rounded-lg px-3 py-2 text-center">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Strike</div>
            <div className="text-sm font-bold text-white">${candidate.strike.toFixed(2)}</div>
          </div>
          <div className="my-2 w-px bg-white/10" />
          <div className="flex-1 rounded-lg px-3 py-2 text-center">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Expiry</div>
            <div className="text-sm font-semibold text-zinc-200">{candidate.expiry} <span className="text-zinc-500">({candidate.dte}d)</span></div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="flex flex-col justify-center rounded-xl bg-white/5 p-3 border border-white/5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Premium</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-emerald-400">${candidate.premium.toFixed(2)}</span>
              <span className="text-xs text-zinc-500">x100</span>
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-xl bg-white/5 p-3 border border-white/5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Max Loss</div>
            <div className="mt-1 text-lg font-bold text-red-400">${candidate.max_loss.toLocaleString()}</div>
          </div>
          <div className="flex flex-col justify-center rounded-xl bg-white/5 p-3 border border-white/5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">POP</div>
            <div className="mt-1 text-lg font-bold text-white">{(candidate.pop * 100).toFixed(1)}%</div>
          </div>
          <div className="flex flex-col justify-center rounded-xl bg-white/5 p-3 border border-white/5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">IV Rank</div>
            <div className="mt-1 text-lg font-bold text-white">{candidate.iv_rank.toFixed(1)}</div>
          </div>
        </div>

        {/* Greeks */}
        <div className="mb-5 flex items-center justify-between px-2 text-xs font-medium text-zinc-500">
          <span className="flex items-center gap-1" title="Delta"><TrendingUp className="h-3 w-3" /> {candidate.delta.toFixed(3)}</span>
          <span className="flex items-center gap-1" title="Theta">Θ {candidate.theta.toFixed(4)}</span>
          <span className="flex items-center gap-1" title="Vega">ν {candidate.vega.toFixed(3)}</span>
        </div>

        {/* AI Analysis */}
        <div className="mb-5 rounded-xl border border-white/10 bg-black/40 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-indigo-600" />
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">AI Score</span>
            </div>
            <span className={cn(
              "text-sm font-black",
              candidate.ai_score > 80 ? "text-emerald-400" : candidate.ai_score > 60 ? "text-amber-400" : "text-red-400"
            )}>{candidate.ai_score.toFixed(0)}/100</span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-300">{candidate.ai_brief}</p>
          {risks.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {risks.map((risk: string, i: number) => (
                <span key={i} className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400 border border-red-500/20">
                  <ShieldAlert className="h-3 w-3" />
                  {risk}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onAddToQueue(candidate.id)}
        disabled={inQueue || disabled}
        className={cn(
          "group/btn relative mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-300 overflow-hidden",
          inQueue
            ? "bg-white/5 text-emerald-400 cursor-not-allowed border border-emerald-500/20"
            : disabled
            ? "bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5"
            : "bg-gradient-to-r from-primary to-indigo-600 text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0"
        )}
      >
        {inQueue ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            In Queue
          </>
        ) : disabled ? (
          'Capital Limit Reached'
        ) : (
          <>
            <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover/btn:translate-y-0" />
            <PlusCircle className="relative h-4 w-4" />
            <span className="relative">Add to Queue</span>
          </>
        )}
      </button>
    </div>
  );
}
