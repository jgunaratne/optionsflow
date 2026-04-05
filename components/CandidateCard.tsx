'use client';

import type { Candidate } from '@/lib/db';

interface CandidateCardProps {
  candidate: Candidate;
  onAddToQueue: (id: number) => void;
  inQueue?: boolean;
  disabled?: boolean;
}

export default function CandidateCard({ candidate, onAddToQueue, inQueue, disabled }: CandidateCardProps) {
  const flagColor = candidate.ai_flag === 'GREEN'
    ? 'bg-emerald-400' : candidate.ai_flag === 'YELLOW'
    ? 'bg-amber-400' : 'bg-red-400';

  const flagBorder = candidate.ai_flag === 'GREEN'
    ? 'border-emerald-500/20' : candidate.ai_flag === 'YELLOW'
    ? 'border-amber-500/20' : 'border-red-500/20';

  const strategyColors: Record<string, string> = {
    CSP: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    CC: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    BULL_PUT_SPREAD: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    COLLAR: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  };

  const risks = candidate.ai_risks ? JSON.parse(candidate.ai_risks) as string[] : [];

  return (
    <div className={`group relative overflow-hidden rounded-xl border ${flagBorder} bg-zinc-900/80 p-5 transition-all duration-300 hover:bg-zinc-900 hover:shadow-lg hover:shadow-black/20`}>
      {/* Flag dot */}
      <div className={`absolute right-4 top-4 h-3 w-3 rounded-full ${flagColor} shadow-lg shadow-current/30`} />

      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        <div>
          <h3 className="text-xl font-bold text-white">{candidate.symbol}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${strategyColors[candidate.strategy] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
              {candidate.strategy}
            </span>
            <span className="text-xs text-zinc-500">${candidate.underlying_price.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Strike + Expiry */}
      <div className="mb-4 rounded-lg bg-zinc-800/50 px-3 py-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Strike</span>
          <span className="font-semibold text-white">${candidate.strike.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Expiry</span>
          <span className="font-medium text-zinc-200">{candidate.expiry} ({candidate.dte}d)</span>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-800/30 p-2.5">
          <div className="text-xs text-zinc-500">Premium</div>
          <div className="text-sm font-semibold text-emerald-400">${candidate.premium.toFixed(2)}</div>
          <div className="text-xs text-zinc-600">${(candidate.premium * 100).toFixed(0)}/contract</div>
        </div>
        <div className="rounded-lg bg-zinc-800/30 p-2.5">
          <div className="text-xs text-zinc-500">Max Loss</div>
          <div className="text-sm font-semibold text-red-400">${candidate.max_loss.toLocaleString()}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/30 p-2.5">
          <div className="text-xs text-zinc-500">POP</div>
          <div className="text-sm font-semibold text-white">{(candidate.pop * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded-lg bg-zinc-800/30 p-2.5">
          <div className="text-xs text-zinc-500">IV Rank</div>
          <div className="text-sm font-semibold text-white">{candidate.iv_rank.toFixed(1)}</div>
        </div>
      </div>

      {/* Greeks */}
      <div className="mb-4 flex items-center gap-4 text-xs text-zinc-500">
        <span>Δ {candidate.delta.toFixed(3)}</span>
        <span>Θ {candidate.theta.toFixed(4)}</span>
        <span>ν {candidate.vega.toFixed(3)}</span>
      </div>

      {/* AI Analysis */}
      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400">AI Score</span>
          <span className="text-sm font-bold text-white">{candidate.ai_score.toFixed(0)}/100</span>
        </div>
        <p className="text-xs leading-relaxed text-zinc-400">{candidate.ai_brief}</p>
        {risks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {risks.map((risk: string, i: number) => (
              <span key={i} className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">
                {risk}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Add to Queue */}
      <button
        onClick={() => onAddToQueue(candidate.id)}
        disabled={inQueue || disabled}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
          inQueue
            ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
            : disabled
            ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
            : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 active:scale-[0.98]'
        }`}
      >
        {inQueue ? '✓ In Queue' : disabled ? 'Capital Limit Reached' : 'Add to Queue'}
      </button>
    </div>
  );
}
