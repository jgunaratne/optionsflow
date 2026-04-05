'use client';

import type { Candidate } from '@/lib/db';
import { PlusCircle, CheckCircle2 } from 'lucide-react';
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
      "relative border bg-black p-3 font-mono transition-colors hover:bg-zinc-900",
      flagBorderClass
    )}>
      {/* Symbol + Price */}
      <div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{candidate.symbol}</span>
          <span className="text-[10px] bg-zinc-800 px-1 text-zinc-400">{candidate.strategy}</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-white">${candidate.underlying_price.toFixed(2)}</div>
        </div>
      </div>

      {/* Contract Details */}
      <div className="mb-2 grid grid-cols-2 gap-x-4 text-[11px] leading-tight text-zinc-400">
        <div className="flex justify-between">
          <span>STRIKE</span>
          <span className="text-white">${candidate.strike.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>EXPIRY</span>
          <span className="text-white">{candidate.expiry}</span>
        </div>
        <div className="flex justify-between">
          <span>DTE</span>
          <span className="text-white">{candidate.dte}d</span>
        </div>
        <div className="flex justify-between">
          <span>IVR</span>
          <span className="text-white">{candidate.iv_rank.toFixed(1)}</span>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="mb-2 grid grid-cols-3 gap-1 border-y border-zinc-800 py-1.5">
        <div className="text-center">
          <div className="text-[9px] text-zinc-500 uppercase">Premium</div>
          <div className="text-sm font-bold terminal-green">${candidate.premium.toFixed(2)}</div>
        </div>
        <div className="text-center border-x border-zinc-800">
          <div className="text-[9px] text-zinc-500 uppercase">POP</div>
          <div className="text-sm font-bold text-white">{(candidate.pop * 100).toFixed(0)}%</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-zinc-500 uppercase">Risk</div>
          <div className="text-sm font-bold terminal-red">${candidate.max_loss.toLocaleString()}</div>
        </div>
      </div>

      {/* Greeks (Condensed) */}
      <div className="mb-2 flex justify-between px-1 text-[10px] text-zinc-500">
        <span>DEL <span className="text-zinc-300">{candidate.delta.toFixed(3)}</span></span>
        <span>THE <span className="text-zinc-300">{candidate.theta.toFixed(4)}</span></span>
        <span>VEG <span className="text-zinc-300">{candidate.vega.toFixed(3)}</span></span>
      </div>

      {/* AI Box */}
      <div className="mb-2 border border-zinc-800 bg-zinc-900/50 p-2 text-[10px]">
        <div className="mb-1 flex items-center justify-between border-b border-zinc-800 pb-0.5">
          <span className="font-bold text-zinc-500">AI SCORE</span>
          <span className={cn("font-bold", flagColorClass)}>{candidate.ai_score.toFixed(0)}</span>
        </div>
        <p className="line-clamp-2 leading-normal text-zinc-400 italic">"{candidate.ai_brief}"</p>
      </div>

      {/* Compact Add Button */}
      <button
        onClick={() => onAddToQueue(candidate.id)}
        disabled={inQueue || disabled}
        className={cn(
          "w-full border py-1.5 text-[11px] font-bold uppercase transition-all",
          inQueue
            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
            : disabled
            ? "border-zinc-800 bg-zinc-900 text-zinc-600"
            : "border-primary bg-primary/10 text-primary hover:bg-primary hover:text-white"
        )}
      >
        {inQueue ? '✓ QUEUED' : 'ADD TO QUEUE'}
      </button>
    </div>
  );
}
