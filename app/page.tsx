'use client';

import { useEffect, useState } from 'react';
import CandidateCard from '@/components/CandidateCard';
import { useCandidatesStore, useQueueStore } from '@/lib/store';
import { Loader2, Play, Search, Filter, SortDesc, ChevronDown } from 'lucide-react';
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
    setProgress({ running: true, currentSymbol: '', currentIndex: 0, totalSymbols: 0, status: 'STARTING', candidatesFound: 0 });
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
    <div className="flex flex-col gap-4">
      {/* Top Bar - Terminal Style */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-black pb-3">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black text-white tracking-tighter uppercase">Market Screener</h1>
          <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-bold">
             <div className="flex items-center gap-1.5">
               <span className="text-zinc-600">LAST_RUN:</span>
               <span className="text-zinc-300">{lastScreenedAt ? new Date(lastScreenedAt * 1000).toISOString().replace('T', ' ').slice(0, 19) : 'N/A'}</span>
             </div>
             <div className="flex items-center gap-1.5">
               <span className="text-zinc-600">COUNT:</span>
               <span className="terminal-cyan">{candidates.length}</span>
             </div>
          </div>
        </div>

        <button
          onClick={handleRunScreener}
          disabled={screenerRunning}
          className={cn(
            "flex items-center gap-2 border px-4 py-1.5 text-xs font-black uppercase transition-all",
            screenerRunning
              ? "border-zinc-800 bg-zinc-900 text-zinc-600"
              : "border-primary bg-primary/10 text-primary hover:bg-primary hover:text-white"
          )}
        >
          {screenerRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
          {screenerRunning ? 'SCANNING' : 'RUN_SCREENER'}
        </button>
      </div>

      {/* Compact Progress Bar */}
      {progress && progress.running && (
        <div className="border border-zinc-800 bg-zinc-950 p-2">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold">
            <div className="flex items-center gap-2">
              <span className="terminal-green">{progress.status}</span>
              <span className="text-zinc-500">[{progress.currentSymbol || '...'}]</span>
            </div>
            <span className="text-white">{progressPercent}%</span>
          </div>
          <div className="h-1 bg-zinc-900">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* High-Density Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-1 border-r border-zinc-800 pr-2 mr-1">
          <span className="text-[9px] font-bold text-zinc-600 uppercase">Strat:</span>
          <select
            value={filters.strategy || ''}
            onChange={(e) => { setFilters({ strategy: e.target.value || undefined }); fetchCandidates(); }}
            className="bg-black text-[10px] font-bold text-white outline-none border border-zinc-800 px-1 py-0.5"
          >
            <option value="">ALL</option>
            <option value="CSP">CSP</option>
            <option value="CC">CC</option>
            <option value="BULL_PUT_SPREAD">SPREAD</option>
            <option value="COLLAR">COLLAR</option>
          </select>
        </div>

        <div className="flex items-center gap-1 border-r border-zinc-800 pr-2 mr-1">
          <span className="text-[9px] font-bold text-zinc-600 uppercase">Flag:</span>
          <select
            value={filters.flag || ''}
            onChange={(e) => { setFilters({ flag: e.target.value || undefined }); fetchCandidates(); }}
            className="bg-black text-[10px] font-bold text-white outline-none border border-zinc-800 px-1 py-0.5"
          >
            <option value="">ALL</option>
            <option value="GREEN">GREEN</option>
            <option value="YELLOW">YELLOW</option>
            <option value="RED">RED</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold text-zinc-600 uppercase">Min_POP:</span>
          <input
            type="number"
            min="0" max="100" step="5"
            onChange={(e) => { setFilters({ min_pop: e.target.value ? parseFloat(e.target.value) / 100 : undefined }); fetchCandidates(); }}
            className="w-10 bg-black text-[10px] font-bold text-white outline-none border border-zinc-800 px-1 py-0.5"
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <span className="text-[9px] font-bold text-zinc-600 uppercase">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-black text-[10px] font-bold terminal-amber outline-none border border-zinc-800 px-1 py-0.5"
          >
            <option value="ai_score">AI_SCORE</option>
            <option value="pop">POP</option>
            <option value="premium">PREMIUM</option>
            <option value="iv_rank">IV_RANK</option>
          </select>
        </div>
      </div>

      {/* Content Grid - Dense */}
      {loading ? (
        <div className="flex h-40 items-center justify-center border border-dashed border-zinc-800">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-600 mr-2" />
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Loading_Data...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center border border-dashed border-zinc-800 text-zinc-700">
          <Search className="h-6 w-6 mb-2 opacity-20" />
          <span className="text-[10px] font-black uppercase">No_Records_Found</span>
        </div>
      ) : (
        <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
