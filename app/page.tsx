'use client';

import { useEffect, useState } from 'react';
import CandidateCard from '@/components/CandidateCard';
import { useCandidatesStore, useQueueStore } from '@/lib/store';
import { Search, Loader2, Play, Filter, SortDesc, Calendar, CheckCircle2, ChevronDown, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScreenerProgress {
  running: boolean;
  currentSymbol: string;
  currentIndex: number;
  totalSymbols: number;
  status: string;
  candidatesFound: number;
}

export default function ScreenerPage() {
  const { candidates, loading, lastScreenedAt, filters, fetchCandidates, setFilters } = useCandidatesStore();
  const { queue, addToQueue, fetchQueue } = useQueueStore();
  const [screenerRunning, setScreenerRunning] = useState(false);
  const [progress, setProgress] = useState<ScreenerProgress | null>(null);
  const [sortBy, setSortBy] = useState<string>('ai_score');

  useEffect(() => { fetchCandidates(); fetchQueue(); }, [fetchCandidates, fetchQueue]);

  const queuedIds = new Set(queue.map(q => q.candidate_id));

  const sorted = [...candidates].sort((a, b) => {
    switch (sortBy) {
      case 'pop': return b.pop - a.pop;
      case 'premium': return b.premium - a.premium;
      case 'iv_rank': return b.iv_rank - a.iv_rank;
      default: return b.ai_score - a.ai_score;
    }
  });

  const handleRunScreener = async () => {
    setScreenerRunning(true);
    setProgress({ running: true, currentSymbol: '', currentIndex: 0, totalSymbols: 0, status: 'Starting...', candidatesFound: 0 });
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

  const progressPercent = progress && progress.totalSymbols > 0
    ? Math.round((progress.currentIndex / progress.totalSymbols) * 100)
    : 0;

  return (
    <div className="pb-12">
      {/* Header Area */}
      <div className="relative mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Screener
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
            <Calendar className="h-4 w-4" />
            {lastScreenedAt
              ? `Last run: ${new Date(lastScreenedAt * 1000).toLocaleString()}`
              : 'No screener results yet'}
          </div>
        </div>
        
        <button
          onClick={handleRunScreener}
          disabled={screenerRunning}
          className={cn(
            "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-8 py-4 font-bold transition-all duration-300",
            screenerRunning
              ? "cursor-not-allowed bg-white/5 text-zinc-500 border border-white/10"
              : "bg-gradient-to-r from-primary to-indigo-600 text-white shadow-[0_0_40px_rgba(124,58,237,0.3)] hover:shadow-[0_0_60px_rgba(124,58,237,0.5)] hover:-translate-y-1 active:translate-y-0"
          )}
        >
          {screenerRunning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Scanning Markets...</span>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform duration-300 group-hover:translate-y-0" />
              <Play className="relative h-5 w-5 fill-current" />
              <span className="relative">Run Screener</span>
            </>
          )}
        </button>
      </div>

      {/* Progress Bar */}
      {progress && progress.running && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-1 backdrop-blur-md">
          <div className="rounded-xl bg-black/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{progress.status}</div>
                  <div className="text-xs font-medium text-zinc-400">
                    {progress.currentSymbol && `Analyzing ${progress.currentSymbol}...`}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-white">{progressPercent}%</div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {progress.candidatesFound} found
                </div>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Completion message */}
      {progress && !progress.running && progress.status !== 'idle' && (
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 backdrop-blur-md">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <span className="font-semibold text-emerald-100">{progress.status}</span>
        </div>
      )}

      {/* Filters & Sorting */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-white/5 bg-black/20 p-2 backdrop-blur-md sm:flex-row sm:items-center sm:p-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/5">
            <Filter className="h-4 w-4 text-zinc-400" />
            <select
              value={filters.strategy || ''}
              onChange={(e) => { setFilters({ strategy: e.target.value || undefined }); fetchCandidates(); }}
              className="appearance-none bg-transparent pr-4 text-sm font-medium text-white outline-none [&>option]:bg-zinc-900"
            >
              <option value="">All Strategies</option>
              <option value="CSP">Cash Secured Put</option>
              <option value="CC">Covered Call</option>
              <option value="BULL_PUT_SPREAD">Put Spread</option>
              <option value="COLLAR">Collar</option>
            </select>
            <ChevronDown className="h-3 w-3 text-zinc-500" />
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/5">
            <ListFilter className="h-4 w-4 text-zinc-400" />
            <select
              value={filters.flag || ''}
              onChange={(e) => { setFilters({ flag: e.target.value || undefined }); fetchCandidates(); }}
              className="appearance-none bg-transparent pr-4 text-sm font-medium text-white outline-none [&>option]:bg-zinc-900"
            >
              <option value="">All Flags</option>
              <option value="GREEN">Green Flags</option>
              <option value="YELLOW">Yellow Flags</option>
              <option value="RED">Red Flags</option>
            </select>
            <ChevronDown className="h-3 w-3 text-zinc-500" />
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/5">
            <span className="text-sm font-medium text-zinc-400">Min POP</span>
            <input
              type="number"
              min="0"
              max="100"
              step="5"
              placeholder="%"
              onChange={(e) => { setFilters({ min_pop: e.target.value ? parseFloat(e.target.value) / 100 : undefined }); fetchCandidates(); }}
              className="w-16 bg-transparent text-sm font-bold text-white placeholder-zinc-600 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 border border-primary/20 sm:ml-auto">
          <SortDesc className="h-4 w-4 text-primary" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none bg-transparent pr-4 text-sm font-bold text-primary outline-none [&>option]:bg-zinc-900"
          >
            <option value="ai_score">Top AI Score</option>
            <option value="pop">Highest POP</option>
            <option value="premium">Max Premium</option>
            <option value="iv_rank">Highest IVR</option>
          </select>
          <ChevronDown className="h-3 w-3 text-primary" />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10 bg-black/20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="font-medium text-zinc-400">Loading your candidates...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10 bg-black/20 text-center p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-zinc-400">
            <Search className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">No candidates found</h3>
            <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
              The screener hasn&apos;t run yet, or no opportunities match your current filters. Click Run Screener to scan the market.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map(candidate => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onAddToQueue={handleAddToQueue}
              inQueue={queuedIds.has(candidate.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
