'use client';

import { useEffect, useState } from 'react';
import CandidateCard from '@/components/CandidateCard';
import { useCandidatesStore, useQueueStore } from '@/lib/store';
import { Loader2, Play, Search } from 'lucide-react';
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
    setProgress({ running: true, currentSymbol: '', currentIndex: 0, totalSymbols: 0, status: 'Starting', candidatesFound: 0 });
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
    <div className="flex flex-col gap-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mt-2">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-medium text-white tracking-tight">Market screener</h1>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
             <div className="flex items-center gap-1.5">
               <span className="text-zinc-600">Last run:</span>
               <span className="text-zinc-300">{lastScreenedAt ? new Date(lastScreenedAt * 1000).toLocaleString() : 'N/A'}</span>
             </div>
             <div className="flex items-center gap-1.5">
               <span className="text-zinc-600">Count:</span>
               <span className="terminal-cyan">{candidates.length}</span>
             </div>
          </div>
        </div>

        <button
          onClick={handleRunScreener}
          disabled={screenerRunning}
          className={cn(
            "flex items-center gap-2 border px-4 py-1.5 text-xs transition-all rounded-sm",
            screenerRunning
              ? "border-zinc-800 bg-zinc-900 text-zinc-600"
              : "border-primary/50 bg-primary/10 text-primary hover:bg-primary hover:text-black"
          )}
        >
          {screenerRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
          {screenerRunning ? 'Scanning...' : 'Run screener'}
        </button>
      </div>

      {/* Compact Progress Bar */}
      {progress && progress.running && (
        <div className="border border-zinc-800 bg-zinc-950 p-3 rounded-sm">
          <div className="mb-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="terminal-green">{progress.status}</span>
              <span className="text-zinc-500">[{progress.currentSymbol || '...'}]</span>
            </div>
            <span className="text-zinc-300">{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 text-xs bg-zinc-900/30 p-2 border border-zinc-800 rounded-sm">
        <div className="flex items-center gap-2 border-r border-zinc-800 pr-4">
          <span className="text-zinc-500">Strategy:</span>
          <select
            value={filters.strategy || ''}
            onChange={(e) => { setFilters({ strategy: e.target.value || undefined }); fetchCandidates(); }}
            className="bg-transparent text-zinc-200 outline-none cursor-pointer"
          >
            <option value="" className="bg-zinc-900">All</option>
            <option value="CSP" className="bg-zinc-900">Cash Secured Put</option>
            <option value="CC" className="bg-zinc-900">Covered Call</option>
            <option value="BULL_PUT_SPREAD" className="bg-zinc-900">Put Spread</option>
            <option value="COLLAR" className="bg-zinc-900">Collar</option>
          </select>
        </div>

        <div className="flex items-center gap-2 border-r border-zinc-800 pr-4">
          <span className="text-zinc-500">Flag:</span>
          <select
            value={filters.flag || ''}
            onChange={(e) => { setFilters({ flag: e.target.value || undefined }); fetchCandidates(); }}
            className="bg-transparent text-zinc-200 outline-none cursor-pointer"
          >
            <option value="" className="bg-zinc-900">All</option>
            <option value="GREEN" className="bg-zinc-900">Green</option>
            <option value="YELLOW" className="bg-zinc-900">Yellow</option>
            <option value="RED" className="bg-zinc-900">Red</option>
          </select>
        </div>

        <div className="flex items-center gap-2 border-r border-zinc-800 pr-4">
          <span className="text-zinc-500">Min POP:</span>
          <input
            type="number"
            min="0" max="100" step="5"
            placeholder="%"
            onChange={(e) => { setFilters({ min_pop: e.target.value ? parseFloat(e.target.value) / 100 : undefined }); fetchCandidates(); }}
            className="w-12 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-700"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 pl-2">
          <span className="text-zinc-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent terminal-cyan outline-none cursor-pointer"
          >
            <option value="ai_score" className="bg-zinc-900 text-zinc-200">AI Score</option>
            <option value="pop" className="bg-zinc-900 text-zinc-200">Probability of Profit</option>
            <option value="premium" className="bg-zinc-900 text-zinc-200">Premium</option>
            <option value="iv_rank" className="bg-zinc-900 text-zinc-200">IV Rank</option>
          </select>
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center border border-dashed border-zinc-800 rounded-sm">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600 mr-3" />
          <span className="text-sm text-zinc-500">Loading data...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center border border-dashed border-zinc-800 text-zinc-600 rounded-sm">
          <Search className="h-8 w-8 mb-3 opacity-30" />
          <span className="text-sm">No records found</span>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
