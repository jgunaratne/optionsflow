'use client';

import { useEffect, useState } from 'react';
import QueueItem from '@/components/QueueItem';
import SectorChart from '@/components/SectorChart';
import { useQueueStore, useAccountStore } from '@/lib/store';
import { calculateSectorExposure } from '@/lib/risk';
import { ListChecks, Play, AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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
    <div className="flex flex-col gap-4 font-mono">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h1 className="text-xl font-black text-white tracking-tighter uppercase">Execution Queue</h1>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Pending_Orders // Pre_Trade_Risk</p>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
        <div className="bg-black p-3">
          <div className="text-[9px] font-black text-zinc-600 uppercase">Total Items</div>
          <div className="text-lg font-black text-white">{queue.length}</div>
        </div>
        <div className="bg-black p-3">
          <div className="text-[9px] font-black text-zinc-600 uppercase">Est. Premium</div>
          <div className="text-lg font-black terminal-green">${totalPremium.toFixed(0)}</div>
        </div>
        <div className="bg-black p-3">
          <div className="text-[9px] font-black text-zinc-600 uppercase">Max Risk</div>
          <div className="text-lg font-black terminal-red">${totalMaxLoss.toLocaleString()}</div>
        </div>
        <div className="bg-black p-3">
          <div className="text-[9px] font-black text-zinc-600 uppercase">Cap. Impact</div>
          <div className={cn(
            "text-lg font-black",
            deployedPct > 50 ? 'terminal-red' : deployedPct > 30 ? 'terminal-amber' : 'terminal-green'
          )}>
            {deployedPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Queue List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="border border-zinc-800 bg-zinc-950 p-2">
            <div className="flex items-center gap-2 mb-3 px-2">
               <ListChecks className="h-3 w-3 text-zinc-500" />
               <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Order Review</span>
            </div>
            
            {loading ? (
              <div className="flex h-32 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-zinc-800" /></div>
            ) : queue.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center border border-dashed border-zinc-900 text-zinc-800">
                <span className="text-[10px] font-black uppercase">Queue_Is_Empty</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {queue.map(item => (
                  <QueueItem key={item.queue_id} item={item} onRemove={removeFromQueue} onQuantityChange={handleQuantityChange} />
                ))}
              </div>
            )}
          </div>

          {/* Execution Feedback */}
          {executionResult && (
            <div className="border border-zinc-800 bg-zinc-950 p-3">
              <div className="flex items-center gap-2 mb-2">
                 <CheckCircle2 className="h-3 w-3 terminal-green" />
                 <span className="text-[10px] font-black terminal-green uppercase tracking-widest">Batch Execution Result</span>
              </div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase mb-3">
                {executionResult.summary.filled} FILLED // {executionResult.summary.failed} FAILED
              </div>
              <div className="space-y-1">
                {executionResult.results.map((r, i) => (
                  <div key={i} className={cn(
                    "flex items-center justify-between border-l-2 px-2 py-1 text-[11px] font-bold uppercase",
                    r.status === 'FILLED' ? "border-emerald-500 bg-emerald-500/5 terminal-green" : "border-red-500 bg-red-500/5 terminal-red"
                  )}>
                    <span>{r.symbol}</span>
                    <span>{r.status} {r.premium ? `| $${r.premium.toFixed(0)}` : ''} {r.error ? `| ERR: ${r.error}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blockers */}
          {reviewResult && reviewResult.blockers.length > 0 && (
            <div className="border border-terminal-red/30 bg-terminal-red/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                 <XCircle className="h-3 w-3 terminal-red" />
                 <span className="text-[10px] font-black terminal-red uppercase tracking-widest">Execution Blocked</span>
              </div>
              {reviewResult.blockers.map((b, i) => <p key={i} className="text-[11px] font-bold terminal-red uppercase tracking-tighter">{`> ${b}`}</p>)}
            </div>
          )}

          {/* Execution Actions */}
          {queue.length > 0 && (
            <div className="mt-2">
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={executing || (reviewResult?.blockers && reviewResult.blockers.length > 0)}
                  className="w-full border border-primary bg-primary/10 py-3 text-xs font-black text-primary transition-all hover:bg-primary hover:text-white disabled:opacity-30 disabled:grayscale"
                >
                  EXECUTE_BATCH_ALL ({queue.length} ORDERS)
                </button>
              ) : (
                <div className="border border-terminal-amber/30 bg-terminal-amber/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                     <AlertCircle className="h-3 w-3 terminal-amber" />
                     <span className="text-[10px] font-black terminal-amber uppercase tracking-widest">Confirmation Required</span>
                  </div>
                  <p className="mb-4 text-[11px] font-bold text-zinc-400 uppercase">Submit {queue.length} trade(s) to market? Total credit: ${totalPremium.toFixed(0)}</p>
                  <div className="flex gap-2">
                    <button onClick={handleExecute} disabled={executing}
                      className="border border-emerald-500 bg-emerald-500/20 px-6 py-2 text-[11px] font-black terminal-green hover:bg-emerald-500 hover:text-black disabled:opacity-50 transition-all">
                      {executing ? 'PROCESSING...' : 'CONFIRM_ORDER'}
                    </button>
                    <button onClick={() => setShowConfirm(false)}
                      className="border border-zinc-800 bg-zinc-900 px-6 py-2 text-[11px] font-black text-zinc-500 hover:bg-zinc-800 hover:text-white transition-all">
                      CANCEL_REQUEST
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sector Exposure Side */}
        <div className="border border-zinc-800 bg-zinc-950 p-3">
           <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Queue Sector Metrics</span>
           </div>
           <SectorChart data={sectorData} />
        </div>
      </div>
    </div>
  );
}
