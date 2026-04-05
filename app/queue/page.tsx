'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QueueItem from '@/components/QueueItem';
import SectorChart from '@/components/SectorChart';
import { useQueueStore, useAccountStore, useBrokerStore } from '@/lib/store';
import { calculateSectorExposure } from '@/lib/risk';
import { ListChecks, AlertCircle, CheckCircle2, XCircle, Loader2, Zap, ShieldCheck } from 'lucide-react';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function QueuePage() {
  const { queue, loading, fetchQueue, removeFromQueue } = useQueueStore();
  const { account, error: accountError, fetchAccount } = useAccountStore();
  const { active } = useBrokerStore();
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
    <div className="flex flex-col gap-4">
      {/* Header Area */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Trade Queue</h1>
          <p className="text-sm text-zinc-400 mt-1 font-medium">Order review and batch execution center</p>
        </div>
      </div>

      {accountError && (
        <div className={cn("rounded border p-4 backdrop-blur-sm", accountError.needsAuth ? "border-amber-900/30 bg-amber-950/20" : "border-red-900/30 bg-red-950/20")}>
          <div className="flex items-start gap-3">
            {accountError.needsAuth ? <KeyRound className="mt-0.5 h-4 w-4 text-amber-500" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />}
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", accountError.needsAuth ? "text-amber-400" : "text-red-400")}>
                {accountError.needsAuth ? `${active.charAt(0).toUpperCase() + active.slice(1)} connection required` : 'Account data unavailable'}
              </p>
              <p className="mt-1 text-xs text-zinc-300 break-words">{accountError.message}</p>
              {accountError.needsAuth && (
                <div className="mt-3">
                  <Link href="/positions" className="text-xs font-medium text-primary hover:text-primary/80">
                    Go to Positions to reconnect {active}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/40 border border-white/10 p-4 rounded backdrop-blur-sm shadow-sm">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Total Orders</div>
          <div className="text-2xl font-bold text-white">{queue.length}</div>
        </div>
        <div className="bg-zinc-900/40 border border-white/10 p-4 rounded backdrop-blur-sm shadow-sm">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Est. Premium</div>
          <div className="text-2xl font-bold terminal-green">${totalPremium.toFixed(0)}</div>
        </div>
        <div className="bg-zinc-900/40 border border-white/10 p-4 rounded backdrop-blur-sm shadow-sm">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Max Risk</div>
          <div className="text-2xl font-bold text-zinc-200">${totalMaxLoss.toLocaleString()}</div>
        </div>
        <div className="bg-zinc-900/40 border border-white/10 p-4 rounded backdrop-blur-sm shadow-sm">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Cap. Impact</div>
          <div className={cn(
            "text-2xl font-bold",
            deployedPct > 50 ? 'terminal-red' : deployedPct > 30 ? 'terminal-amber' : 'terminal-green'
          )}>
            {deployedPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Order Review List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-zinc-900/20 border border-white/10 p-4 rounded backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6 px-1">
               <ListChecks className="h-5 w-5 text-primary" />
               <span className="text-base font-bold text-zinc-100 tracking-tight">Order Review</span>
            </div>
            
            {loading ? (
              <div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-zinc-700" /></div>
            ) : queue.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center border border-dashed border-white/10 bg-white/5 rounded">
                <ShieldCheck className="h-10 w-10 text-zinc-800 mb-2" />
                <span className="text-sm font-medium text-zinc-400">The execution queue is currently empty</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {queue.map(item => (
                  <QueueItem key={item.queue_id} item={item} onRemove={removeFromQueue} onQuantityChange={handleQuantityChange} />
                ))}
              </div>
            )}
          </div>

          {/* Execution History / Result */}
          {executionResult && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded">
              <div className="flex items-center gap-2 mb-4">
                 <CheckCircle2 className="h-5 w-5 terminal-green" />
                 <span className="text-base font-bold terminal-green tracking-tight">Batch Execution Complete</span>
              </div>
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6 px-1">
                {executionResult.summary.filled} Filled • {executionResult.summary.failed} Failed
              </div>
              <div className="space-y-2">
                {executionResult.results.map((r, i) => (
                  <div key={i} className={cn(
                    "flex items-center justify-between border border-white/10 px-4 py-3 text-sm rounded shadow-sm",
                    r.status === 'FILLED' ? "bg-emerald-500/10 terminal-green" : "bg-red-500/10 terminal-red"
                  )}>
                    <span className="font-bold">{r.symbol}</span>
                    <span className="font-medium">{r.status} {r.premium ? `| $${r.premium.toFixed(0)} Credit` : ''} {r.error ? `| ${r.error}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blockers / Errors */}
          {reviewResult && reviewResult.blockers.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 p-4 rounded">
              <div className="flex items-center gap-2 mb-4">
                 <XCircle className="h-5 w-5 terminal-red" />
                 <span className="text-base font-bold terminal-red tracking-tight">Execution Blocked</span>
              </div>
              <div className="space-y-2">
                {reviewResult.blockers.map((b, i) => (
                  <div key={i} className="flex items-start gap-3 bg-red-500/5 p-3 rounded border border-red-500/10">
                     <AlertCircle className="h-4 w-4 terminal-red mt-0.5" />
                     <p className="text-sm font-medium text-red-300">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execution CTAs */}
          {queue.length > 0 && (
            <div className="px-1">
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
 
                  disabled={executing || !!accountError || (reviewResult?.blockers && reviewResult.blockers.length > 0)}
                  className="group relative flex w-full items-center justify-center gap-2 rounded bg-gradient-to-r from-zinc-200 to-zinc-400 py-4 text-sm font-bold text-zinc-950 shadow-lg shadow-white/10 transition-all hover:-translate-y-0.5 hover:shadow-white/20 active:translate-y-0 disabled:opacity-50 disabled:grayscale"

                >
                  <Zap className="h-4 w-4" />
                  <span>Execute Order Batch ({queue.length})</span>
                </button>
              ) : (
                <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded shadow-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-3">
                     <AlertCircle className="h-5 w-5 text-amber-500" />
                     <span className="text-lg font-bold text-amber-500 tracking-tight">Authorize Transaction</span>
                  </div>
                  <p className="mb-6 text-sm text-zinc-400 font-medium">Are you sure you want to submit {queue.length} orders to market? Total credit expected: <span className="text-white font-bold">${totalPremium.toFixed(0)}</span></p>
                  <div className="flex gap-3">
                    <button onClick={handleExecute} disabled={executing}
                      className="flex-1 bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all rounded">
                      {executing ? 'Processing...' : 'Confirm Submission'}
                    </button>
                    <button onClick={() => setShowConfirm(false)}
                      className="flex-1 border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm font-bold text-zinc-400 hover:text-white transition-all rounded">
                      Abort Request
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sector Exposure Sidebar */}
        <div className="bg-zinc-900/20 border border-white/10 p-4 rounded backdrop-blur-sm self-start">
           <div className="flex items-center gap-2 mb-6">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Queue Composition</span>
           </div>
           <SectorChart data={sectorData} />
        </div>
      </div>
    </div>
  );
}
