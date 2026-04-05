'use client';

import { useEffect, useState } from 'react';
import CandidateCard from '@/components/CandidateCard';
import { useCandidatesStore, useQueueStore } from '@/lib/store';

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

      // Poll for progress — start quickly to catch fast runs
      const pollStatus = async () => {
        try {
          const res = await fetch('/api/screener/status');
          const data: ScreenerProgress = await res.json();
          setProgress(data);
          return data;
        } catch { return null; }
      };

      // First poll after 200ms to catch fast completions
      await new Promise(r => setTimeout(r, 200));
      const first = await pollStatus();
      if (first && !first.running) {
        setScreenerRunning(false);
        await fetchCandidates();
        setTimeout(() => setProgress(null), 5000);
        return;
      }

      // Continue polling every second
      const interval = setInterval(async () => {
        const data = await pollStatus();
        if (data && !data.running) {
          clearInterval(interval);
          setScreenerRunning(false);
          await fetchCandidates();
          setTimeout(() => setProgress(null), 5000);
        }
      }, 1000);
      // Safety timeout
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
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Screener</h1>
          <p className="text-sm text-zinc-500">
            {lastScreenedAt
              ? `Last run: ${new Date(lastScreenedAt * 1000).toLocaleString()}`
              : 'No screener results yet'}
          </p>
        </div>
        <button
          onClick={handleRunScreener}
          disabled={screenerRunning}
          className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
            screenerRunning
              ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30'
          }`}
        >
          {screenerRunning ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Running...
            </>
          ) : '🔍 Run Screener'}
        </button>
      </div>

      {/* Progress Bar */}
      {progress && progress.running && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin text-violet-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              <span className="text-sm font-medium text-zinc-200">{progress.status}</span>
            </div>
            <span className="text-xs text-zinc-500">{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress.candidatesFound > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              {progress.candidatesFound} candidate{progress.candidatesFound !== 1 ? 's' : ''} found so far
            </p>
          )}
        </div>
      )}

      {/* Completion message */}
      {progress && !progress.running && progress.status !== 'idle' && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-4">
          <span className="text-lg">✅</span>
          <span className="text-sm text-emerald-300">{progress.status}</span>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-400">Strategy</label>
          <select
            value={filters.strategy || ''}
            onChange={(e) => { setFilters({ strategy: e.target.value || undefined }); fetchCandidates(); }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="">All</option>
            <option value="CSP">CSP</option>
            <option value="CC">CC</option>
            <option value="BULL_PUT_SPREAD">Spread</option>
            <option value="COLLAR">Collar</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-400">Flag</label>
          <select
            value={filters.flag || ''}
            onChange={(e) => { setFilters({ flag: e.target.value || undefined }); fetchCandidates(); }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="">All</option>
            <option value="GREEN">🟢 Green</option>
            <option value="YELLOW">🟡 Yellow</option>
            <option value="RED">🔴 Red</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-400">Min POP</label>
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            placeholder="%"
            onChange={(e) => { setFilters({ min_pop: e.target.value ? parseFloat(e.target.value) / 100 : undefined }); fetchCandidates(); }}
            className="w-16 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-400">Sort</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="ai_score">AI Score</option>
            <option value="pop">POP</option>
            <option value="premium">Premium</option>
            <option value="iv_rank">IV Rank</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3">
            <svg className="h-6 w-6 animate-spin text-violet-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <span className="text-zinc-400">Loading candidates...</span>
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30">
          <span className="text-4xl">🔍</span>
          <p className="text-sm text-zinc-500">Screener hasn&apos;t run yet. Click Run Screener to find candidates.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
