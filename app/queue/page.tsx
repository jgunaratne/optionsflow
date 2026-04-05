'use client';

import { useEffect, useState } from 'react';
import QueueItem from '@/components/QueueItem';
import SectorChart from '@/components/SectorChart';
import { useQueueStore, useAccountStore } from '@/lib/store';
import { calculateSectorExposure } from '@/lib/risk';

export default function QueuePage() {
  const { queue, loading, fetchQueue, removeFromQueue } = useQueueStore();
  const { account, fetchAccount } = useAccountStore();
  const [executing, setExecuting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ warnings: string[]; blockers: string[] } | null>(null);
  const [executionResult, setExecutionResult] = useState<{ results: Array<{ symbol: string; status: string; premium?: number; error?: string }>; summary: { total: number; filled: number; failed: number } } | null>(null);

  useEffect(() => { fetchQueue(); fetchAccount(); }, [fetchQueue, fetchAccount]);

  const totalPremium = queue.reduce((sum, item) => sum + item.premium * 100 * item.quantity, 0);
  const totalMaxLoss = queue.reduce((sum, item) => sum + item.max_loss * item.quantity, 0);
  const deployedPct = account ? ((totalMaxLoss / account.totalValue) * 100) : 0;

  const sectorData = calculateSectorExposure(queue.map(q => ({ symbol: q.symbol, max_loss: q.max_loss, quantity: q.quantity })));

  const handleExecute = async () => {
    setExecuting(true);
    setExecutionResult(null);
    try {
      const res = await fetch('/api/execute', { method: 'POST' });
      const data = await res.json();
      if (data.approved === false) {
        setReviewResult({ warnings: data.warnings || [], blockers: data.blockers || [] });
        setShowConfirm(false);
      } else {
        setExecutionResult(data);
        setShowConfirm(false);
        await fetchQueue();
      }
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setExecuting(false);
    }
  };

  const handleQuantityChange = async (_id: number, _quantity: number) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Queue quantity changes would need a PATCH endpoint; for now, this is UI-only
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Trade Queue</h1>
        <p className="text-sm text-zinc-500">Review and execute queued trades</p>
      </div>

      {/* Summary Panel */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-500">Trades</div>
          <div className="text-2xl font-bold text-white">{queue.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-500">Total Premium</div>
          <div className="text-2xl font-bold text-emerald-400">${totalPremium.toFixed(0)}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-500">Total Max Loss</div>
          <div className="text-2xl font-bold text-red-400">${totalMaxLoss.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-500">Capital Deployed</div>
          <div className={`text-2xl font-bold ${deployedPct > 50 ? 'text-red-400' : deployedPct > 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {deployedPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Queue List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex h-32 items-center justify-center"><span className="text-zinc-500">Loading...</span></div>
          ) : queue.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30">
              <span className="text-4xl">📋</span>
              <p className="text-sm text-zinc-500">No trades queued. Add candidates from the Screener.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {queue.map(item => (
                <QueueItem key={item.queue_id} item={item} onRemove={removeFromQueue} onQuantityChange={handleQuantityChange} />
              ))}
            </div>
          )}

          {/* Execution Results */}
          {executionResult && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h3 className="mb-2 font-semibold text-white">Execution Results</h3>
              <div className="text-sm text-zinc-400">
                {executionResult.summary.filled} filled, {executionResult.summary.failed} failed
              </div>
              {executionResult.results.map((r, i) => (
                <div key={i} className={`mt-2 text-sm ${r.status === 'FILLED' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.symbol}: {r.status} {r.premium ? `— $${r.premium.toFixed(0)} premium` : ''} {r.error ? `— ${r.error}` : ''}
                </div>
              ))}
            </div>
          )}

          {/* Review Blockers */}
          {reviewResult && reviewResult.blockers.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <h3 className="mb-2 font-semibold text-red-400">⛔ Execution Blocked</h3>
              {reviewResult.blockers.map((b, i) => <p key={i} className="text-sm text-red-300">{b}</p>)}
            </div>
          )}

          {/* Execute Button */}
          {queue.length > 0 && (
            <div className="mt-4">
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={executing || (reviewResult?.blockers && reviewResult.blockers.length > 0)}
                  className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:shadow-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Execute All ({queue.length} trades)
                </button>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <h3 className="mb-2 font-semibold text-amber-300">⚠️ Confirm Execution</h3>
                  <p className="mb-4 text-sm text-zinc-400">Submit {queue.length} trade(s) to your broker? Total premium: ${totalPremium.toFixed(0)}</p>
                  <div className="flex gap-3">
                    <button onClick={handleExecute} disabled={executing}
                      className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                      {executing ? 'Executing...' : 'Confirm'}
                    </button>
                    <button onClick={() => setShowConfirm(false)}
                      className="rounded-lg border border-zinc-700 px-6 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sector Chart */}
        <div>
          <SectorChart data={sectorData} />
        </div>
      </div>
    </div>
  );
}
