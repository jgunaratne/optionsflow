'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import ScenarioTable from '@/components/ScenarioTable';
import SectorChart from '@/components/SectorChart';
import RiskGauge from '@/components/RiskGauge';
import { useStreamStore, useAccountStore, useBrokerStore } from '@/lib/store';
import { calculateCapitalAllocation, type CrashScenario, type SectorExposure } from '@/lib/risk';
import { Activity, ShieldAlert, BarChart, PieChart, RefreshCw } from 'lucide-react';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PortfolioPage() {
  const { vix } = useStreamStore();
  const { account, error, loading, cachedAt, source, fetchAccount } = useAccountStore();
  const { active } = useBrokerStore();
  const greeks = { totalDelta: 0, totalTheta: 0, totalVega: 0 };
  const scenarios: CrashScenario[] = [];
  const sectorData: SectorExposure[] = [];

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  const allocation = account
    ? calculateCapitalAllocation(account.totalValue, account.deployedCapital)
    : null;
  const brokerLabel = active.charAt(0).toUpperCase() + active.slice(1);
  const cacheLabel = cachedAt
    ? `Cached ${new Date(cachedAt * 1000).toLocaleString()}`
    : 'No cached account data yet';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Portfolio Risk</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Stress tests, Greeks, and Capital Allocation
            {source === 'live' ? ` · refreshed from ${brokerLabel} just now` : ` · ${cacheLabel}`}
          </p>
        </div>
        <button
          onClick={() => fetchAccount(true)}
          disabled={loading}
          className="flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-white/10 hover:text-white rounded-2xl disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {loading ? `Refreshing ${brokerLabel}` : `Refresh from ${brokerLabel}`}
        </button>
      </div>

      {error && (
        <div className={cn("rounded-2xl border p-6 backdrop-blur-md shadow-xl", error.needsAuth ? "border-amber-900/30 bg-amber-950/20" : "border-red-900/30 bg-red-950/20")}>
          <div className="flex items-start gap-5">
            {error.needsAuth ? <KeyRound className="mt-0.5 h-4 w-4 text-amber-500" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />}
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", error.needsAuth ? "text-amber-400" : "text-red-400")}>
                {error.needsAuth ? `${active.charAt(0).toUpperCase() + active.slice(1)} connection required` : 'Account data unavailable'}
              </p>
              <p className="mt-1 text-sm text-zinc-300 break-words">{error.message}</p>
              {error.needsAuth && (
                <div className="mt-3">
                  <Link href="/positions" className="text-sm font-medium text-primary hover:text-primary/80">
                    Go to Positions to reconnect {active}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Row */}
      <div className="flex flex-wrap items-center gap-10 bg-white/5 border border-white/10 p-6 rounded-2xl">
        <div className="flex flex-col items-center">
          <RiskGauge value={vix || 0} label="VIX" max={50} thresholds={{ green: 20, yellow: 30 }} />
        </div>
        <div className="h-10 w-px bg-white/10 hidden lg:block" />
        <div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Cash</div>
          <div className="text-2xl font-bold text-white">${(account?.totalValue || 0).toLocaleString()}</div>
        </div>
        <div className="h-10 w-px bg-white/10 hidden sm:block" />
        <div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Available</div>
          <div className="text-2xl font-bold text-zinc-100">${(account?.buyingPower || 0).toLocaleString()}</div>
        </div>
        <div className="h-10 w-px bg-white/10 hidden lg:block" />
        <div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Usage</div>
          <div className={cn(
            "text-2xl font-bold",
            (account?.deployedPct || 0) > 0.7 ? 'text-red-400' : (account?.deployedPct || 0) > 0.4 ? 'text-amber-400' : 'text-emerald-400'
          )}>
            {((account?.deployedPct || 0) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Greeks and Allocation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Greeks */}
        <div className="bg-zinc-900/20 border border-white/10 p-6 rounded-2xl backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
             <Activity className="h-4 w-4 text-primary" />
             <span className="text-sm font-bold text-zinc-200">Portfolio Greeks</span>
          </div>
          <div className="flex flex-wrap items-center justify-around gap-4 text-center">
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Direction Risk</div>
              <div className="text-lg font-bold text-zinc-100">{greeks.totalDelta.toFixed(1)}</div>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Time Value</div>
              <div className="text-lg font-bold text-emerald-400">+${greeks.totalTheta.toFixed(2)}</div>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Hype Risk</div>
              <div className="text-lg font-bold text-zinc-100">{greeks.totalVega.toFixed(1)}</div>
            </div>
          </div>
        </div>

        {/* Resource Allocation */}
        {allocation && (
          <div className="bg-zinc-900/20 border border-white/10 p-6 rounded-2xl backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
               <BarChart className="h-4 w-4 text-primary" />
               <span className="text-sm font-bold text-zinc-200">Resource Allocation</span>
            </div>
            <div className="mb-5 flex h-2.5 bg-white/5 rounded-sm overflow-hidden border border-white/10">
              <div className="bg-primary shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-all" style={{ width: `${allocation.deployedPct * 100}%` }} />
              <div className="bg-emerald-500/40 transition-all" style={{ width: `${allocation.availablePct * 100}%` }} />
              <div className="bg-zinc-800 transition-all" style={{ width: `${allocation.bufferPct * 100}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-tight text-zinc-400">
              <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-primary" /> Deployed: {(allocation.deployedPct * 100).toFixed(1)}%</div>
              <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500/40" /> Available: {(allocation.availablePct * 100).toFixed(1)}%</div>
              <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-zinc-800" /> Buffer: {(allocation.bufferPct * 100).toFixed(1)}%</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900/20 border border-white/10 p-6 rounded-2xl backdrop-blur-md shadow-xl">
           <ScenarioTable scenarios={scenarios} totalValue={account?.totalValue || 0} />
        </div>
        <div className="bg-zinc-900/20 border border-white/10 p-6 rounded-2xl backdrop-blur-md shadow-xl">
           <div className="flex items-center gap-2 mb-6">
              <PieChart className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-zinc-200">Sector Exposure</span>
           </div>
           <SectorChart data={sectorData} />
        </div>
      </div>

      {/* Collar Manager */}
      <div className="bg-zinc-900/20 border border-white/10 p-6 rounded-2xl backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2 mb-2">
           <ShieldAlert className="h-5 w-5 text-amber-500" />
           <span className="text-base font-bold text-zinc-100 tracking-tight">Active Hedging Engine</span>
        </div>
        <p className="text-sm text-zinc-400 mb-8">Real-time collar recommendations for SPY, QQQ, and IWM positions</p>
        <div className="flex h-16 items-center justify-center">
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Waiting for data feed from broker...</p>
        </div>
      </div>
    </div>
  );
}
