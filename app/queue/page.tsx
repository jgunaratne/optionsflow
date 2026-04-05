'use client';

import { useEffect, useState } from 'react';
import QueueItem from '@/components/QueueItem';
import SectorChart from '@/components/SectorChart';
import { useQueueStore, useAccountStore } from '@/lib/store';
import { calculateSectorExposure } from '@/lib/risk';
import { ListChecks, AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const handleQuantityChange = async () => {};

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mt-2">
        <div>
          <h1 className="text-xl font-medium text-white tracking-tight">Execution queue</h1>
          <p className="text-xs text-zinc-500 mt-1">Pending orders & pre-trade risk</p>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-4 rounded-sm overflow-hidden">
        <div className="bg-black p-4">
          <div className="text-xs text-zinc-500">Total items</div>
          <div className="text-lg text-white mt-1">{queue.length}</div>
        </div>
        <div className="bg-black p-4">
          <div className="text-xs text-zinc-500">Est. premium</div>
          <div className="text-lg terminal-green mt-1">${totalPremium.toFixed(0)}</div>
        </div>
        <div className="bg-black p-4">
          <div className="text-xs text-zinc-500">Max risk</div>
          <div className="text-lg text-zinc-200 mt-1">${totalMaxLoss.toLocaleString()}</div>
        </div>
        <div className="bg-black p-4">
          <div className="text-xs text-zinc-500">Cap. impact</div>
          <div className={cn(
            "text-lg mt-1",
            deployedPct > 50 ? 'terminal-red' : deployedPct > 30 ? 'terminal-amber' : 'terminal-green'
          )}>
            {deployedPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Queue List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="border border-zinc-800 bg-zinc-950/30 p-4 rounded-sm">
            <div className="flex items-center gap-2 mb-4">
               <ListChecks className="h-4 w-4 text-zinc-500" />
               <span className="text-sm font-medium text-zinc-300">Order review</span>
            </div>
            
            {loading ? (
              <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-600" /></div>
            ) : queue.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center border border-dashed border-zinc-800/50 text-zinc-600 rounded-sm">
                <span className="text-sm">Queue is empty</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {queue.map(item => (
                  <QueueItem key={item.queue_id} item={item} onRemove={removeFromQueue} onQuantityChange={handleQuantityChange} />
                ))}
              </div>
            )}
          </div>

          {/* Execution Feedback */}
          {executionResult && (
            <div className="border border-zinc-800 bg-zinc-950/30 p-4 rounded-sm">
              <div className="flex items-center gap-2 mb-3">
                 <CheckCircle2 className="h-4 w-4 terminal-green" />
                 <span className="text-sm font-medium terminal-green">Batch execution result</span>
              </div>
              <div className="text-xs text-zinc-400 mb-4">
                {executionResult.summary.filled} filled, {executionResult.summary.failed} failed
              </div>
              <div className="space-y-2">
                {executionResult.results.map((r, i) => (
                  <div key={i} className={cn(
                    "flex items-center justify-between border-l-2 px-3 py-2 text-xs",
                    r.status === 'FILLED' ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-400" : "border-red-500/50 bg-red-500/5 text-red-400"
                  )}>
                    <span className="font-medium">{r.symbol}</span>
                    <span>{r.status} {r.premium ? `• $${r.premium.toFixed(0)}` : ''} {r.error ? `• ${r.error}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blockers */}
          {reviewResult && reviewResult.blockers.length > 0 && (
            <div className="border border-red-900/30 bg-red-950/20 p-4 rounded-sm">
              <div className="flex items-center gap-2 mb-3">
                 <XCircle className="h-4 w-4 text-red-500" />
                 <span className="text-sm font-medium text-red-400">Execution blocked</span>
              </div>
              <div className="space-y-2">
                {reviewResult.blockers.map((b, i) => <p key={i} className="text-sm text-red-300 flex items-start gap-2"><span className="text-red-500 mt-0.5">•</span> {b}</p>)}
              </div>
            </div>
          )}

          {/* Execution Actions */}
          {queue.length > 0 && (
            <div className="mt-2">
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={executing || (reviewResult?.blockers && reviewResult.blockers.length > 0)}
                  className="w-full border border-primary/50 bg-primary/10 py-3.5 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-black disabled:opacity-50 disabled:grayscale rounded-sm"
                >
                  Execute batch ({queue.length} orders)
                </button>
              ) : (
                <div className="border border-amber-900/30 bg-amber-950/20 p-5 rounded-sm">
                  <div className="flex items-center gap-2 mb-3">
                     <AlertCircle className="h-4 w-4 text-amber-500" />
                     <span className="text-sm font-medium text-amber-500">Confirmation required</span>
                  </div>
                  <p className="mb-5 text-sm text-zinc-300">Submit {queue.length} trade(s) to market? Total credit: ${totalPremium.toFixed(0)}</p>
                  <div className="flex gap-3">
                    <button onClick={handleExecute} disabled={executing}
                      className="border border-emerald-500/50 bg-emerald-500/20 px-6 py-2.5 text-sm text-emerald-400 hover:bg-emerald-500 hover:text-black disabled:opacity-50 transition-all rounded-sm">
                      {executing ? 'Processing...' : 'Confirm order'}
                    </button>
                    <button onClick={() => setShowConfirm(false)}
                      className="border border-zinc-700 bg-zinc-800/50 px-6 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all rounded-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sector Exposure Side */}
        <div className="border border-zinc-800 bg-zinc-950/30 p-4 rounded-sm self-start">
           <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-zinc-300">Queue sector exposure</span>
           </div>
           <SectorChart data={sectorData} />
        </div>
      </div>
    </div>
  );
}
