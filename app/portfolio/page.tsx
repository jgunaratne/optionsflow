'use client';

import { useEffect } from 'react';
import ScenarioTable from '@/components/ScenarioTable';
import SectorChart from '@/components/SectorChart';
import RiskGauge from '@/components/RiskGauge';
import { useStreamStore, useAccountStore } from '@/lib/store';
import { calculateCapitalAllocation, type CrashScenario, type SectorExposure } from '@/lib/risk';
import { Activity, ShieldAlert, BarChart, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PortfolioPage() {
  const { vix } = useStreamStore();
  const { account, fetchAccount } = useAccountStore();
  const greeks = { totalDelta: 0, totalTheta: 0, totalVega: 0 };
  const scenarios: CrashScenario[] = [];
  const sectorData: SectorExposure[] = [];

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  const allocation = account
    ? calculateCapitalAllocation(account.totalValue, account.deployedCapital)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mt-2">
        <div>
          <h1 className="text-xl font-medium text-white tracking-tight">Portfolio risk metrics</h1>
          <p className="text-xs text-zinc-500 mt-1">Stress tests and Greeks</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-4 rounded-sm overflow-hidden">
        <div className="bg-black p-4 flex flex-col items-center justify-center">
          <RiskGauge value={vix || 0} label="VIX" max={50} thresholds={{ green: 20, yellow: 30 }} />
        </div>
        <div className="bg-black p-4">
          <div className="text-xs text-zinc-500">Net liquidity</div>
          <div className="mt-2 text-lg text-white">${(account?.totalValue || 0).toLocaleString()}</div>
        </div>
        <div className="bg-black p-4">
          <div className="text-xs text-zinc-500">Available cash</div>
          <div className="mt-2 text-lg terminal-green">${(account?.buyingPower || 0).toLocaleString()}</div>
        </div>
        <div className="bg-black p-4">
          <div className="text-xs text-zinc-500">Capital deployed</div>
          <div className={cn(
            "mt-2 text-lg",
            (account?.deployedPct || 0) > 0.7 ? 'terminal-red' : (account?.deployedPct || 0) > 0.4 ? 'terminal-amber' : 'terminal-green'
          )}>
            {((account?.deployedPct || 0) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Portfolio Greeks Bar */}
      <div className="border border-zinc-800 bg-zinc-950/30 p-4 rounded-sm">
        <div className="flex items-center gap-2 mb-3">
           <Activity className="h-4 w-4 text-zinc-500" />
           <span className="text-sm font-medium text-zinc-300">Net portfolio Greeks</span>
        </div>
        <div className="grid grid-cols-3 gap-px bg-zinc-800 border border-zinc-800 rounded-sm overflow-hidden">
          <div className="bg-black p-3 text-center">
            <div className="text-xs text-zinc-500 mb-1">Delta (Δ)</div>
            <div className="text-base text-zinc-100">{greeks.totalDelta.toFixed(1)}</div>
          </div>
          <div className="bg-black p-3 text-center">
            <div className="text-xs text-zinc-500 mb-1">Theta (Θ)</div>
            <div className="text-base terminal-green">+${greeks.totalTheta.toFixed(2)}</div>
          </div>
          <div className="bg-black p-3 text-center">
            <div className="text-xs text-zinc-500 mb-1">Vega (ν)</div>
            <div className="text-base text-zinc-100">{greeks.totalVega.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Capital Allocation Bar */}
      {allocation && (
        <div className="border border-zinc-800 bg-zinc-950/30 p-4 rounded-sm">
          <div className="flex items-center gap-2 mb-4">
             <BarChart className="h-4 w-4 text-zinc-500" />
             <span className="text-sm font-medium text-zinc-300">Resource allocation</span>
          </div>
          <div className="mb-4 flex h-2.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
            <div className="bg-primary transition-all" style={{ width: `${allocation.deployedPct * 100}%` }} />
            <div className="bg-emerald-500/30 transition-all" style={{ width: `${allocation.availablePct * 100}%` }} />
            <div className="bg-zinc-800 transition-all" style={{ width: `${allocation.bufferPct * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-sm bg-primary" /> Deployed: {(allocation.deployedPct * 100).toFixed(1)}%</div>
            <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-sm bg-emerald-500/30" /> Available: {(allocation.availablePct * 100).toFixed(1)}%</div>
            <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-sm bg-zinc-800" /> Buffer: {(allocation.bufferPct * 100).toFixed(1)}%</div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="border border-zinc-800 bg-zinc-950/30 p-4 rounded-sm">
           <ScenarioTable scenarios={scenarios} totalValue={account?.totalValue || 0} />
        </div>
        <div className="border border-zinc-800 bg-zinc-950/30 p-4 rounded-sm">
           <div className="flex items-center gap-2 mb-4">
              <PieChart className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-300">Sector exposure</span>
           </div>
           <SectorChart data={sectorData} />
        </div>
      </div>

      {/* Collar Manager */}
      <div className="border border-zinc-800 bg-zinc-950/30 p-4 rounded-sm">
        <div className="flex items-center gap-2 mb-2">
           <ShieldAlert className="h-4 w-4 text-amber-500" />
           <span className="text-sm font-medium text-zinc-300">Dynamic protection engine</span>
        </div>
        <p className="text-xs text-zinc-500 mb-4">Active hedging & index collar recommendations</p>
        <div className="flex h-24 items-center justify-center border border-dashed border-zinc-800 bg-black/40 rounded-sm">
          <p className="text-xs text-zinc-600">Waiting for broker data feed...</p>
        </div>
      </div>
    </div>
  );
}
