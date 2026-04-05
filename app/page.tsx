'use client';

import { useEffect, useState, useRef } from 'react';
import CandidateCard from '@/components/CandidateCard';
import CandidateScatterChart from '@/components/CandidateScatterChart';
import type { Candidate } from '@/lib/db';
import { useCandidatesStore, useQueueStore } from '@/lib/store';
import { Loader2, Play, Filter, SortDesc, Calendar, Layers, LayoutGrid, Rows3, PlusCircle, CheckCircle2, Gauge } from 'lucide-react';
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

interface ScreenerUniverse {
  mode: 'watchlist' | 'sp500';
  symbols: string[];
  totalAvailable: number;
  batchSize: number | null;
  startIndex: number | null;
  summary: string;
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
      "grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_2fr_100px] items-center gap-6 border-b border-white/5 px-4 py-3 text-sm last:border-b-0",      candidate.is_eligible === 0 && "bg-white/[0.02] text-zinc-500"
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
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">Cash Earned</div>
        <div className="font-semibold text-emerald-400">${candidate.premium.toFixed(2)}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">Max Risk</div>
        <div className="font-semibold text-zinc-100">${candidate.max_loss.toLocaleString()}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">Win Chance</div>
        <div className="font-semibold text-zinc-100">{(candidate.pop * 100).toFixed(0)}%</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">Hype Score</div>
        <div className="font-semibold text-zinc-100">{candidate.iv_rank.toFixed(1)}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">Direction Risk</div>
        <div className="font-semibold text-zinc-100">{candidate.delta.toFixed(3)}</div>
      </div>
      <div className="min-w-0 group relative cursor-help">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">Why</div>
        <div className="truncate text-sm text-zinc-400">{recommendation.summary}</div>
        
        {/* Tooltip Card */}
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/95 p-6 shadow-xl backdrop-blur-md relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-zinc-500 to-zinc-700" aria-hidden="true" />
             <div className="mb-2 flex items-center justify-between">
               <span className="text-sm font-bold uppercase tracking-wider text-zinc-400">Plain English</span>
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
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all",
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
  const [screenerUniverse, setScreenerUniverse] = useState<'watchlist' | 'sp500'>('watchlist');
  const [sp500BatchSize, setSp500BatchSize] = useState<number>(50);
  const [universeSummary, setUniverseSummary] = useState<ScreenerUniverse | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [applyingPreset, setApplyingPreset] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchCandidates(); fetchQueue(); }, [fetchCandidates, fetchQueue]);

  // Load screener settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.settings?.iv_rank_min !== undefined) setIvRankMin(data.settings.iv_rank_min);
      if (data.settings?.screener_universe === 'sp500' || data.settings?.screener_universe === 'watchlist') {
        setScreenerUniverse(data.settings.screener_universe);
      }
      if (typeof data.settings?.sp500_batch_size === 'number') {
        setSp500BatchSize(data.settings.sp500_batch_size);
      }
    }).catch(() => {});
  }, []);

  const fetchUniverseSummary = async () => {
    try {
      const res = await fetch('/api/screener/universe');
      const data = await res.json();
      if (data.universe) setUniverseSummary(data.universe);
    } catch {}
  };

  useEffect(() => {
    fetchUniverseSummary();
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
        await fetchUniverseSummary();
        setTimeout(() => setProgress(null), 5000);
        return;
      }
      const interval = setInterval(async () => {
        const data = await pollStatus();
        if (data && !data.running) {
          clearInterval(interval);
          setScreenerRunning(false);
          await fetchCandidates();
          await fetchUniverseSummary();
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

  const updateUniverseSetting = async (nextUniverse: 'watchlist' | 'sp500') => {
    setScreenerUniverse(nextUniverse);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screener_universe: nextUniverse }),
    }).catch(() => {});
    await fetchUniverseSummary();
  };

  const updateSp500BatchSize = async (nextBatchSize: number) => {
    const clamped = Math.max(25, Math.min(100, nextBatchSize || 50));
    setSp500BatchSize(clamped);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sp500_batch_size: clamped }),
    }).catch(() => {});
    await fetchUniverseSummary();
  };

  const progressPercent = progress && progress.totalSymbols > 0
    ? Math.round((progress.currentIndex / progress.totalSymbols) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Screener</h1>
          <div className="mt-2 flex items-center gap-4 text-xs font-medium">
             <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
               <Layers className="h-3 w-3" />
               <span>{eligibleCount} eligible</span>
             </div>
             <div className="flex items-center gap-1.5 text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
               <span>{candidates.length} screened</span>
             </div>
             <div className="flex items-center gap-1.5 text-zinc-500">
               <Calendar className="h-3.5 w-3.5" />
               <span>{lastScreenedAt ? new Date(lastScreenedAt * 1000).toLocaleString() : 'Never'}</span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleApplySaferPreset}
            disabled={applyingPreset}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 border border-white/10 px-4 text-sm font-bold text-zinc-300 transition-all hover:bg-zinc-800 disabled:opacity-50"
          >
            {applyingPreset ? 'Applying...' : 'Safer Preset'}
          </button>
          <button
            onClick={handleRunScreener}
            disabled={screenerRunning}
            className={cn(
              "relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl px-6 text-sm font-bold transition-all duration-300",
              screenerRunning
                ? "bg-zinc-900 text-zinc-400 border border-white/10"
                : "bg-white text-zinc-950 shadow-lg hover:bg-zinc-200 active:scale-95"
            )}
          >
            {screenerRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Run Screener</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Monitor */}
      {progress && progress.running && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div>
                <div className="text-sm font-bold text-white">{progress.status}</div>
                <div className="text-xs text-zinc-400">
                  {progress.currentSymbol ? `Analyzing ${progress.currentSymbol}...` : 'Initializing scan...'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white">{progressPercent}%</div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {progress.candidatesFound} found
              </div>
            </div>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center gap-6 bg-white/5 border border-white/10 px-5 py-3 rounded-xl">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-zinc-500" />
          <select
            value={filters.strategy || ''}
            onChange={(e) => { setFilters({ strategy: e.target.value || undefined }); fetchCandidates(); }}
            className="bg-transparent text-sm font-semibold text-zinc-300 outline-none cursor-pointer"
          >
            <option value="" className="bg-zinc-900">All Strategies</option>
            <option value="CSP" className="bg-zinc-900">Cash Secured Put</option>
            <option value="CC" className="bg-zinc-900">Covered Call</option>
            <option value="BULL_PUT_SPREAD" className="bg-zinc-900">Put Spread</option>
            <option value="COLLAR" className="bg-zinc-900">Collar</option>
          </select>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-tight">Flag:</span>
          <select
            value={filters.flag || ''}
            onChange={(e) => { setFilters({ flag: e.target.value || undefined }); fetchCandidates(); }}
            className="bg-transparent text-sm font-semibold text-zinc-300 outline-none cursor-pointer"
          >
            <option value="" className="bg-zinc-900">All</option>
            <option value="GREEN" className="bg-zinc-900">Green</option>
            <option value="YELLOW" className="bg-zinc-900">Yellow</option>
            <option value="RED" className="bg-zinc-900">Red</option>
          </select>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-tight">Min Pop:</span>
          <input
            type="number"
            min="0" max="100" step="5"
            placeholder="%"
            onChange={(e) => { setFilters({ min_pop: e.target.value ? parseFloat(e.target.value) / 100 : undefined }); fetchCandidates(); }}
            className="w-10 bg-transparent text-sm font-bold text-zinc-100 outline-none placeholder:text-zinc-700"
          />
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-tight">Hype ≥</span>
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
            className="w-10 bg-transparent text-sm font-bold text-zinc-100 outline-none text-center"
          />
          <span className="text-xs text-zinc-500">%</span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => updateUniverseSetting('watchlist')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold transition-all rounded-lg",
              screenerUniverse === 'watchlist' ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Watchlist
          </button>
          <button
            onClick={() => updateUniverseSetting('sp500')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold transition-all rounded-lg",
              screenerUniverse === 'sp500' ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            S&amp;P 500
          </button>
        </div>

        {screenerUniverse === 'sp500' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-tight">Batch</span>
            <input
              type="number"
              min="25"
              max="100"
              step="5"
              value={sp500BatchSize}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10);
                setSp500BatchSize(Number.isNaN(next) ? 50 : next);
              }}
              onBlur={(e) => updateSp500BatchSize(parseInt(e.target.value, 10))}
              className="w-12 bg-transparent text-sm font-bold text-zinc-100 outline-none text-center"
            />
          </div>
        )}

        <div className="sm:ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <SortDesc className="h-3.5 w-3.5 text-zinc-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-sm font-semibold text-zinc-300 outline-none cursor-pointer"
            >
              <option value="ai_score" className="bg-zinc-900 text-zinc-200">AI Score</option>
              <option value="pop" className="bg-zinc-900 text-zinc-200">Win Chance</option>
              <option value="premium" className="bg-zinc-900 text-zinc-200">Cash Earned</option>
              <option value="iv_rank" className="bg-zinc-900 text-zinc-200">Hype Score</option>
            </select>
          </div>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                viewMode === 'grid' ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                viewMode === 'list' ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {universeSummary && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-1 border-b border-white/5 pb-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Universe Settings</div>
            <p className="mt-0.5 text-sm font-medium text-zinc-400">
              {universeSummary.mode === 'watchlist'
                ? `Currently scanning ${universeSummary.symbols.length} names from your watchlist.`
                : `Scanning a rotating batch of ${universeSummary.symbols.length} stocks from the S&P 500.`}
            </p>
          </div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            {universeSummary.mode === 'sp500' && universeSummary.startIndex !== null
              ? `Batch ${universeSummary.startIndex + 1}-${(universeSummary.startIndex || 0) + universeSummary.symbols.length} of ${universeSummary.totalAvailable}`
              : `${universeSummary.totalAvailable} total symbols`}
          </div>
        </div>
      )}

      <div className="flex items-center gap-6 px-1 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          Best Pick
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          Maybe
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-zinc-700" />
          Skip
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-white/10 bg-white/5">
          <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Loading Market Data...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-white/10 bg-white/5 text-zinc-400">
          <div className="text-center">
             <h3 className="text-lg font-bold text-white">No candidates found</h3>
             <p className="text-sm mt-1 text-zinc-500">Adjust your filters or run the screener.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <CandidateScatterChart candidates={sorted} />

          {viewMode === 'grid' ? (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
            <div className="overflow-x-auto border border-white/10 bg-white/5 rounded-2xl">
              <div className="min-w-[1000px]">
                <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_2fr_100px] gap-6 border-b border-white/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                <div>Candidate</div>
                <div className="text-right">Strike</div>
                <div className="text-right">Cash</div>
                <div className="text-right">Risk</div>
                <div className="text-right">Win %</div>
                <div className="text-right">Hype</div>
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
                </div>
          )}
        </div>
      )}    </div>
  );
}
