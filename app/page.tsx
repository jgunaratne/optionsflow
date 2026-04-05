'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import CandidateCard from '@/components/CandidateCard';
import CandidateScatterChart from '@/components/CandidateScatterChart';
import type { Candidate } from '@/lib/db';
import { useCandidatesStore, useQueueStore } from '@/lib/store';
import { Loader2, Play, Search, Filter, SortDesc, Calendar, Layers, LayoutGrid, Rows3, PlusCircle, CheckCircle2, Gauge, KeyRound, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScreenerLogEntry {
  time: number;
  symbol: string;
  message: string;
  type: 'info' | 'skip' | 'found' | 'error';
}

interface ScreenerProgress {
  running: boolean;
  currentSymbol: string;
  currentIndex: number;
  totalSymbols: number;
  status: string;
  candidatesFound: number;
  logs: ScreenerLogEntry[];
}

type ViewMode = 'grid' | 'list';

function getRecommendation(candidate: Candidate) {
  if (candidate.is_eligible === 0) {
    return {
      label: 'Skip',
      tone: 'text-zinc-400 border-zinc-600/40 bg-zinc-800/60',
      summary: candidate.rejection_reason || 'Did not pass the screener rules.',
      action: 'Do not buy this one right now.',
    };
  }

  if (candidate.ai_flag === 'GREEN') {
    return {
      label: 'Best Pick',
      tone: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
      summary: 'Strong fit for the screener rules.',
      action: 'Start here if you want the app’s top ideas.',
    };
  }

  if (candidate.ai_flag === 'YELLOW') {
    return {
      label: 'Maybe',
      tone: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
      summary: 'Some good signs, but not as clean as the best picks.',
      action: 'Review this before you buy.',
    };
  }

  return {
    label: 'Risky',
    tone: 'text-red-400 border-red-500/20 bg-red-500/10',
    summary: 'The app sees more risk or weaker setup quality here.',
    action: 'Only consider this if you understand why it still passed.',
  };
}

function getSimpleReasons(candidate: Candidate): string[] {
  const reasons: string[] = [];
  if (candidate.pop >= 0.8) reasons.push('High chance of profit');
  if (candidate.delta <= 0.2) reasons.push('Lower risk entry');
  if (candidate.dte <= 30) reasons.push('Short time trade');
  if (candidate.premium >= 1) reasons.push('Solid payout');
  if (reasons.length === 0) reasons.push('Passed the safety checks');
  return reasons.slice(0, 3);
}

function CandidateListRow({
  candidate,
  inQueue,
  onAddToQueue,
}: {
  candidate: Candidate;
  inQueue: boolean;
  onAddToQueue: (id: number) => void;
}) {
  const recommendation = getRecommendation(candidate);

  return (
    <div className={cn(
      "grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_2fr_100px] items-center gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-b-0",      candidate.is_eligible === 0 && "bg-white/[0.02] text-zinc-500"
    )}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-white">{candidate.symbol}</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", recommendation.tone)}>
            {recommendation.label}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
          <span>{candidate.strategy}</span>
          <span>•</span>
          <span>{candidate.expiry}</span>
          <span>•</span>
          <span>{candidate.dte}d</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">Strike</div>
        <div className="font-semibold text-zinc-100">${candidate.strike.toFixed(2)}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">Premium</div>
        <div className="font-semibold text-emerald-400">${candidate.premium.toFixed(2)}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">Max Loss</div>
        <div className="font-semibold text-zinc-100">${candidate.max_loss.toLocaleString()}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">POP</div>
        <div className="font-semibold text-zinc-100">{(candidate.pop * 100).toFixed(0)}%</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">IV Rank</div>
        <div className="font-semibold text-zinc-100">{candidate.iv_rank.toFixed(1)}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">Delta</div>
        <div className="font-semibold text-zinc-100">{candidate.delta.toFixed(3)}</div>
      </div>
      <div className="min-w-0 group relative cursor-help">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">Why</div>
        <div className="truncate text-xs text-zinc-400">{recommendation.summary}</div>
        
        {/* Tooltip Card */}
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="rounded border border-white/10 bg-zinc-900/95 p-4 shadow-xl backdrop-blur-md relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-zinc-500 to-zinc-700" aria-hidden="true" />
             <div className="mb-2 flex items-center justify-between">
               <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Plain English</span>
               <span className={cn(
                 "text-sm font-black",
                 candidate.ai_score > 80 ? "text-emerald-400" : candidate.ai_score > 60 ? "text-amber-400" : "text-red-400"
               )}>{candidate.ai_score.toFixed(0)}/100</span>
             </div>
             <p className="text-sm leading-relaxed text-zinc-300 whitespace-normal">
               {recommendation.action} {candidate.is_eligible === 0 ? (candidate.rejection_reason || candidate.ai_brief) : candidate.ai_brief}
             </p>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => onAddToQueue(candidate.id)}
          disabled={inQueue || candidate.is_eligible === 0}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all",
            inQueue
              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : candidate.is_eligible === 0
                ? "border border-zinc-700 bg-zinc-800 text-zinc-500 cursor-not-allowed"
              : "bg-gradient-to-r from-zinc-600 to-zinc-800 text-white shadow-lg shadow-black/40 hover:shadow-black/60"
          )}
        >
          {inQueue ? <CheckCircle2 className="h-3.5 w-3.5" /> : <PlusCircle className="h-3.5 w-3.5" />}
          <span>{inQueue ? 'Queued' : candidate.is_eligible === 0 ? 'Skip' : 'Buy'}</span>
        </button>
      </div>
    </div>
  );
}

export default function ScreenerPage() {
  const { candidates, loading, lastScreenedAt, filters, fetchCandidates, setFilters } = useCandidatesStore();
  const { queue, addToQueue, fetchQueue } = useQueueStore();
  const [screenerRunning, setScreenerRunning] = useState(false);
  const [progress, setProgress] = useState<ScreenerProgress | null>(null);
  const [sortBy, setSortBy] = useState<string>('ai_score');
  const [ivRankMin, setIvRankMin] = useState<number>(50);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [applyingPreset, setApplyingPreset] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchCandidates(); fetchQueue(); }, [fetchCandidates, fetchQueue]);

  // Load screener settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.settings?.iv_rank_min !== undefined) setIvRankMin(data.settings.iv_rank_min);
    }).catch(() => {});
  }, []);

  // Auto-scroll activity feed to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [progress?.logs?.length]);

  const queuedIds = new Set(queue.map(q => q.candidate_id));

  const sorted = [...candidates].sort((a, b) => {
    if (a.is_eligible !== b.is_eligible) return b.is_eligible - a.is_eligible;
    switch (sortBy) {
      case 'pop': return b.pop - a.pop;
      case 'premium': return b.premium - a.premium;
      case 'iv_rank': return b.iv_rank - a.iv_rank;
      default: return b.ai_score - a.ai_score;
    }
  });
  const eligibleCount = sorted.filter((candidate) => candidate.is_eligible === 1).length;
  const topPicks = sorted.filter((candidate) => candidate.is_eligible === 1).slice(0, 3);

  const handleRunScreener = async () => {
    setScreenerRunning(true);
    setProgress({ running: true, currentSymbol: '', currentIndex: 0, totalSymbols: 0, status: 'Starting', candidatesFound: 0, logs: [] });
    try {
      await fetch('/api/screener/run', { method: 'POST' });
      const pollStatus = async () => {
        try {
          const res = await fetch('/api/screener/status');
          const data: ScreenerProgress = await res.json();
          setProgress(data);
          return data;
        } catch { return null; }
      };
      await new Promise(r => setTimeout(r, 200));
      const first = await pollStatus();
      if (first && !first.running) {
        setScreenerRunning(false);
        await fetchCandidates();
        setTimeout(() => setProgress(null), 5000);
        return;
      }
      const interval = setInterval(async () => {
        const data = await pollStatus();
        if (data && !data.running) {
          clearInterval(interval);
          setScreenerRunning(false);
          await fetchCandidates();
          setTimeout(() => setProgress(null), 5000);
        }
      }, 1000);
      setTimeout(() => { clearInterval(interval); setScreenerRunning(false); }, 300000);
    } catch { setScreenerRunning(false); }
  };

  const handleAddToQueue = async (id: number) => {
    await addToQueue(id, 1);
    await fetchQueue();
  };

  const handleApplySaferPreset = async () => {
    setApplyingPreset(true);
    try {
      setIvRankMin(50);
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dte_min: 14,
          dte_max: 30,
          delta_min: 0.10,
          delta_max: 0.20,
          iv_rank_min: 50,
          min_premium: 0.50,
          max_bid_ask_spread_pct: 0.05,
          min_open_interest: 1000,
        }),
      });
    } finally {
      setApplyingPreset(false);
    }
  };

  const progressPercent = progress && progress.totalSymbols > 0
    ? Math.round((progress.currentIndex / progress.totalSymbols) * 100)
    : 0;
  const dataAsOfLabel = lastScreenedAt
    ? new Date(lastScreenedAt * 1000).toLocaleString()
    : 'No screener data yet';

  return (
    <div className="flex flex-col gap-4">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Screener</h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-zinc-400 font-medium">
             <div className="flex items-center gap-1.5">
               <Calendar className="h-4 w-4 text-zinc-400" />
               <span>Last run: {lastScreenedAt ? new Date(lastScreenedAt * 1000).toLocaleString() : 'Never'}</span>
             </div>
             <div className="flex items-center gap-1.5">
               <Layers className="h-4 w-4 text-zinc-600" />
               <span className="text-emerald-400">{eligibleCount} eligible</span>
               <span className="text-zinc-600">/</span>
               <span>{candidates.length} screened</span>
             </div>
          </div>
        </div>

        <button
          onClick={handleRunScreener}
          disabled={screenerRunning}
          className={cn(
            "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded px-6 py-3 text-sm font-bold transition-all duration-300",
            screenerRunning
              ? "bg-zinc-900 text-zinc-400 border border-white/10"
              : "bg-gradient-to-r from-zinc-600 to-zinc-800 text-white shadow-lg shadow-black/40 hover:shadow-black/60 hover:-translate-y-0.5 active:translate-y-0"
          )}
        >
          {screenerRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Scanning Markets...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              <span>Run Screener</span>
            </>
          )}
        </button>
      </div>

      {/* Progress Monitor */}
      {progress && progress.running && (
        <div className="relative overflow-hidden rounded border border-primary/20 bg-primary/5 p-1 backdrop-blur-md shadow-xl">
          <div className="rounded bg-zinc-950/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white uppercase tracking-wider">{progress.status}</div>
                  <div className="text-xs font-medium text-zinc-400">
                    {progress.currentSymbol ? `Analyzing ${progress.currentSymbol}...` : 'Initializing scan...'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-white">{progressPercent}%</div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  {progress.candidatesFound} found
                </div>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-zinc-500 to-zinc-700 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Live Activity Feed */}
      {progress && progress.logs && progress.logs.length > 0 && (
        <div className="relative overflow-hidden rounded border border-white/10 bg-zinc-950/40 backdrop-blur-md shadow-xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                progress.running ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
              )} />
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Activity Log</span>
            </div>
            <span className="text-[10px] font-medium text-zinc-400">
              {progress.logs.length} events
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto p-2 space-y-0.5 scroll-smooth" ref={logsEndRef}>
            {progress.logs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  log.type === 'skip' && "text-zinc-400",
                  log.type === 'info' && "text-zinc-300",
                  log.type === 'found' && "text-emerald-400 bg-emerald-500/5",
                  log.type === 'error' && "text-red-400 bg-red-500/5",
                )}
              >
                <span className="shrink-0 mt-px">
                  {log.type === 'skip' && '⏭'}
                  {log.type === 'info' && '⚡'}
                  {log.type === 'found' && '✅'}
                  {log.type === 'error' && '❌'}
                </span>
                {log.symbol && (
                  <span className={cn(
                    "shrink-0 font-bold min-w-[4ch]",
                    log.type === 'found' ? "text-emerald-300" : "text-zinc-400"
                  )}>
                    {log.symbol}
                  </span>
                )}
                <span className="truncate">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {progress && !progress.running && progress.status.includes('Schwab not connected') && (
        <div className="relative overflow-hidden rounded border border-amber-500/20 bg-amber-500/5 p-1 backdrop-blur-md shadow-xl">
          <div className="rounded bg-zinc-950/30 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-amber-500/10 text-amber-400">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-amber-400">Schwab connection required</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    The options screener needs Schwab market data. Connect your Schwab account from the Positions page, then run the screener again.
                  </p>
                </div>
              </div>
              <Link
                href="/positions"
                className="inline-flex items-center justify-center gap-2 rounded bg-gradient-to-r from-zinc-600 to-zinc-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/40 transition-all hover:shadow-black/60"
              >
                Connect Schwab
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white/5 p-3 border border-white/10 rounded backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2 rounded bg-zinc-950/30 px-3 py-2 border border-white/10">
          <Filter className="h-4 w-4 text-zinc-400" />
          <select
            value={filters.strategy || ''}
            onChange={(e) => { setFilters({ strategy: e.target.value || undefined }); fetchCandidates(); }}
            className="bg-transparent text-sm font-medium text-zinc-300 outline-none cursor-pointer"
          >
            <option value="" className="bg-zinc-900">All Strategies</option>
            <option value="CSP" className="bg-zinc-900">Cash Secured Put</option>
            <option value="CC" className="bg-zinc-900">Covered Call</option>
            <option value="BULL_PUT_SPREAD" className="bg-zinc-900">Put Spread</option>
            <option value="COLLAR" className="bg-zinc-900">Collar</option>
          </select>
        </div>

        <div className="flex items-center gap-2 rounded bg-zinc-950/30 px-3 py-2 border border-white/10">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">Flag:</span>
          <select
            value={filters.flag || ''}
            onChange={(e) => { setFilters({ flag: e.target.value || undefined }); fetchCandidates(); }}
            className="bg-transparent text-sm font-medium text-zinc-300 outline-none cursor-pointer"
          >
            <option value="" className="bg-zinc-900">All</option>
            <option value="GREEN" className="bg-zinc-900">Green</option>
            <option value="YELLOW" className="bg-zinc-900">Yellow</option>
            <option value="RED" className="bg-zinc-900">Red</option>
          </select>
        </div>

        <div className="flex items-center gap-2 rounded bg-zinc-950/30 px-3 py-2 border border-white/10">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">Min Pop:</span>
          <input
            type="number"
            min="0" max="100" step="5"
            placeholder="%"
            onChange={(e) => { setFilters({ min_pop: e.target.value ? parseFloat(e.target.value) / 100 : undefined }); fetchCandidates(); }}
            className="w-10 bg-transparent text-sm font-bold text-zinc-100 outline-none placeholder:text-zinc-700"
          />
        </div>

        <div className="flex items-center gap-2 rounded bg-zinc-950/30 px-3 py-2 border border-white/10">
          <Gauge className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">IV Rank ≥</span>
          <input
            type="number"
            min="0" max="100" step="5"
            value={ivRankMin}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setIvRankMin(val);
              fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ iv_rank_min: val }),
              }).catch(() => {});
            }}
            className="w-10 bg-transparent text-sm font-bold text-amber-400 outline-none text-center"
          />
          <span className="text-xs text-zinc-400">%</span>
        </div>

        <div className="sm:ml-auto flex items-center gap-2 rounded bg-primary/10 px-4 py-2 border border-primary/20">
          <SortDesc className="h-4 w-4 text-primary" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-sm font-bold text-primary outline-none cursor-pointer"
          >
            <option value="ai_score" className="bg-zinc-900 text-zinc-200">AI Score</option>
            <option value="pop" className="bg-zinc-900 text-zinc-200">Probability</option>
            <option value="premium" className="bg-zinc-900 text-zinc-200">Premium</option>
            <option value="iv_rank" className="bg-zinc-900 text-zinc-200">IV Rank</option>
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-950/30 p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors",
              viewMode === 'grid' ? "bg-white text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors",
              viewMode === 'list' ? "bg-white text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Rows3 className="h-3.5 w-3.5" />
            List
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded border border-white/10 bg-zinc-900/20 p-4 text-sm text-zinc-300 md:grid-cols-3">
        <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Best Pick</div>
          <p className="mt-1">Green cards are the app’s favorite ideas. If you want the clearest starting point, look here first.</p>
        </div>
        <div className="rounded border border-amber-500/20 bg-amber-500/10 p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Maybe</div>
          <p className="mt-1">Yellow cards have some good signs, but they are not as clean. Check them before buying.</p>
        </div>
        <div className="rounded border border-zinc-700 bg-zinc-800/60 p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">Skip</div>
          <p className="mt-1">Gray cards did not make the cut. They stay on screen so you can see what was rejected and why.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded border border-primary/20 bg-primary/5 p-4 text-sm text-zinc-300 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Safer Short-Term Mode</div>
          <p className="mt-1">This preset looks for options with a better chance of working soon, not the biggest payout.</p>
        </div>
        <button
          onClick={handleApplySaferPreset}
          disabled={applyingPreset}
          className="inline-flex items-center justify-center rounded bg-gradient-to-r from-primary to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {applyingPreset ? 'Applying...' : 'Use Safer Settings'}
        </button>
      </div>

      <div className="rounded border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
        <span className="font-bold text-white">Data as of:</span> {dataAsOfLabel}
      </div>

      {topPicks.length > 0 && (
        <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Start Here</h2>
              <p className="mt-1 text-sm text-zinc-300">If you want the simplest answer, these are the first contracts to look at.</p>
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Top 3 picks</div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {topPicks.map((candidate, index) => (
              <div key={candidate.id} className="rounded border border-white/10 bg-zinc-950/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pick {index + 1}</div>
                    <div className="mt-1 text-xl font-bold text-white">{candidate.symbol}</div>
                  </div>
                  <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    {getRecommendation(candidate).label}
                  </div>
                </div>
                <div className="mt-3 text-sm text-zinc-300">
                  Sell the <span className="font-bold text-white">${candidate.strike.toFixed(2)}</span> put that ends on <span className="font-bold text-white">{candidate.expiry}</span>.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {getSimpleReasons(candidate).map((reason) => (
                    <span key={reason} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                      {reason}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-white/5 p-2">
                    <div className="text-zinc-500">Chance it works</div>
                    <div className="mt-1 font-bold text-white">{(candidate.pop * 100).toFixed(0)}%</div>
                  </div>
                  <div className="rounded bg-white/5 p-2">
                    <div className="text-zinc-500">Money in</div>
                    <div className="mt-1 font-bold text-emerald-400">${candidate.premium.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Grid */}
      {loading ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded border border-dashed border-white/10 bg-white/5">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
          <span className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Loading Market Data...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded border border-dashed border-white/10 bg-white/5 text-zinc-400">
          <div className="rounded bg-zinc-900 p-4 border border-white/10 mb-2">
            <Search className="h-10 w-10 opacity-40" />
          </div>
          <div className="text-center">
             <h3 className="text-lg font-bold text-zinc-400">No candidates found</h3>
             <p className="text-sm max-w-xs mt-1">Adjust your filters or run the screener to find new opportunities.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <CandidateScatterChart candidates={sorted} />

          {viewMode === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {sorted.map(candidate => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onAddToQueue={handleAddToQueue}
                  inQueue={queuedIds.has(candidate.id)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-white/10 bg-white/5 backdrop-blur-md shadow-xl">
              <div className="min-w-[1000px]">
                <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_2fr_100px] gap-4 border-b border-white/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">                <div>Candidate</div>
                <div className="text-right">Strike</div>
                <div className="text-right">Premium</div>
                <div className="text-right">Risk</div>
                <div className="text-right">POP</div>
                <div className="text-right">IV Rank</div>
                <div className="text-right">Delta</div>
                <div>AI Brief</div>
                <div className="text-right">Action</div>
              </div>
              <div>
                {sorted.map(candidate => (
                  <CandidateListRow
                    key={candidate.id}
                    candidate={candidate}
                    onAddToQueue={handleAddToQueue}
                    inQueue={queuedIds.has(candidate.id)}
                  />
                ))}
                </div>
                </div>
                </div>          )}
        </div>
      )}    </div>
  );
}
