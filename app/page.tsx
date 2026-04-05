'use client';

import { useEffect, useState, useRef } from 'react';
import CandidateCard from '@/components/CandidateCard';
import { useCandidatesStore, useQueueStore } from '@/lib/store';
import { Loader2, Play, Search, Filter, SortDesc, Calendar, Layers } from 'lucide-react';
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

export default function ScreenerPage() {
  const { candidates, loading, lastScreenedAt, filters, fetchCandidates, setFilters } = useCandidatesStore();
  const { queue, addToQueue, fetchQueue } = useQueueStore();
  const [screenerRunning, setScreenerRunning] = useState(false);
  const [progress, setProgress] = useState<ScreenerProgress | null>(null);
  const [sortBy, setSortBy] = useState<string>('ai_score');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchCandidates(); fetchQueue(); }, [fetchCandidates, fetchQueue]);

  // Auto-scroll activity feed to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [progress?.logs?.length]);

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

  const progressPercent = progress && progress.totalSymbols > 0
    ? Math.round((progress.currentIndex / progress.totalSymbols) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Screener</h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-zinc-500 font-medium">
             <div className="flex items-center gap-1.5">
               <Calendar className="h-4 w-4 text-zinc-600" />
               <span>Last run: {lastScreenedAt ? new Date(lastScreenedAt * 1000).toLocaleString() : 'Never'}</span>
             </div>
             <div className="flex items-center gap-1.5">
               <Layers className="h-4 w-4 text-zinc-600" />
               <span className="text-emerald-400">{candidates.length} candidates found</span>
             </div>
          </div>
        </div>

        <button
          onClick={handleRunScreener}
          disabled={screenerRunning}
          className={cn(
            "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-md px-6 py-3 text-sm font-bold transition-all duration-300",
            screenerRunning
              ? "bg-zinc-900 text-zinc-500 border border-white/5"
              : "bg-gradient-to-r from-primary to-indigo-600 text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0"
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
        <div className="relative overflow-hidden rounded-md border border-primary/20 bg-primary/5 p-1 backdrop-blur-sm">
          <div className="rounded-md bg-zinc-950/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white uppercase tracking-wider">{progress.status}</div>
                  <div className="text-xs font-medium text-zinc-500">
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
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Live Activity Feed */}
      {progress && progress.logs && progress.logs.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/60 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                progress.running ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
              )} />
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Activity Log</span>
            </div>
            <span className="text-[10px] font-medium text-zinc-600">
              {progress.logs.length} events
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto p-2 space-y-0.5 scroll-smooth" ref={logsEndRef}>
            {progress.logs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  log.type === 'skip' && "text-zinc-500",
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

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white/5 p-3 border border-white/5 rounded-md backdrop-blur-sm">
        <div className="flex items-center gap-2 rounded-md bg-zinc-950/50 px-3 py-2 border border-white/5">
          <Filter className="h-4 w-4 text-zinc-500" />
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

        <div className="flex items-center gap-2 rounded-md bg-zinc-950/50 px-3 py-2 border border-white/5">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-tight">Flag:</span>
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

        <div className="flex items-center gap-2 rounded-md bg-zinc-950/50 px-3 py-2 border border-white/5">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-tight">Min Pop:</span>
          <input
            type="number"
            min="0" max="100" step="5"
            placeholder="%"
            onChange={(e) => { setFilters({ min_pop: e.target.value ? parseFloat(e.target.value) / 100 : undefined }); fetchCandidates(); }}
            className="w-10 bg-transparent text-sm font-bold text-zinc-100 outline-none placeholder:text-zinc-700"
          />
        </div>

        <div className="sm:ml-auto flex items-center gap-2 rounded-md bg-primary/10 px-4 py-2 border border-primary/20">
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
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded border border-dashed border-white/10 bg-white/5">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
          <span className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Loading Market Data...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded border border-dashed border-white/10 bg-white/5 text-zinc-500">
          <div className="rounded-md bg-zinc-900 p-6 border border-white/5 mb-2">
            <Search className="h-10 w-10 opacity-20" />
          </div>
          <div className="text-center">
             <h3 className="text-lg font-bold text-zinc-400">No candidates found</h3>
             <p className="text-sm max-w-xs mt-1">Adjust your filters or run the screener to find new opportunities.</p>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
