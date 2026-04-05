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
    <div className="flex flex-col gap-4 font-mono">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h1 className="text-xl font-black text-white tracking-tighter uppercase">Portfolio Risk Metrics</h1>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Stress_Test // Stress_Greeks</p>
        </div>
      </div>

      {/* High-Density Summary Cards */}
      <div className="grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
        <div className="bg-black p-3 flex flex-col items-center justify-center">
          <RiskGauge value={vix || 0} label="VIX" max={50} thresholds={{ green: 20, yellow: 30 }} />
        </div>
        <div className="bg-black p-3">
          <div className="text-[9px] font-black text-zinc-600 uppercase">Net Liquidity</div>
          <div className="mt-1 text-lg font-black text-white">${(account?.totalValue || 0).toLocaleString()}</div>
        </div>
        <div className="bg-black p-3">
          <div className="text-[9px] font-black text-zinc-600 uppercase">Available Cash</div>
          <div className="mt-1 text-lg font-black terminal-green">${(account?.buyingPower || 0).toLocaleString()}</div>
        </div>
        <div className="bg-black p-3">
          <div className="text-[9px] font-black text-zinc-600 uppercase">Capital Deployed</div>
          <div className={cn(
            "mt-1 text-lg font-black",
            (account?.deployedPct || 0) > 0.7 ? 'terminal-red' : (account?.deployedPct || 0) > 0.4 ? 'terminal-amber' : 'terminal-green'
          )}>
            {((account?.deployedPct || 0) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Portfolio Greeks Bar */}
      <div className="border border-zinc-800 bg-zinc-950 p-2">
        <div className="flex items-center gap-2 mb-2">
           <Activity className="h-3 w-3 text-zinc-500" />
           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Net Portfolio Greeks</span>
        </div>
        <div className="grid grid-cols-3 gap-px bg-zinc-800 border border-zinc-800">
          <div className="bg-black p-2 text-center">
            <div className="text-[8px] font-bold text-zinc-600 uppercase">Delta (Δ)</div>
            <div className="text-sm font-black text-white">{greeks.totalDelta.toFixed(1)}</div>
          </div>
          <div className="bg-black p-2 text-center">
            <div className="text-[8px] font-bold text-zinc-600 uppercase">Theta (Θ)</div>
            <div className="text-sm font-black terminal-green">+${greeks.totalTheta.toFixed(2)}</div>
          </div>
          <div className="bg-black p-2 text-center">
            <div className="text-[8px] font-bold text-zinc-600 uppercase">Vega (ν)</div>
            <div className="text-sm font-black text-white">{greeks.totalVega.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Capital Allocation Bar */}
      {allocation && (
        <div className="border border-zinc-800 bg-zinc-950 p-2">
          <div className="flex items-center gap-2 mb-2">
             <BarChart className="h-3 w-3 text-zinc-500" />
             <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Resource Allocation</span>
          </div>
          <div className="mb-2 flex h-3 bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="bg-primary" style={{ width: `${allocation.deployedPct * 100}%` }} />
            <div className="bg-emerald-500/30" style={{ width: `${allocation.availablePct * 100}%` }} />
            <div className="bg-zinc-800" style={{ width: `${allocation.bufferPct * 100}%` }} />
          </div>
          <div className="flex justify-between text-[9px] font-bold uppercase">
            <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 bg-primary" /> DEPLOYED: {(allocation.deployedPct * 100).toFixed(1)}%</div>
            <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 bg-emerald-500/30" /> AVAILABLE: {(allocation.availablePct * 100).toFixed(1)}%</div>
            <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 bg-zinc-800" /> BUFFER: {(allocation.bufferPct * 100).toFixed(1)}%</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-zinc-800 bg-zinc-950 p-2">
           <ScenarioTable scenarios={scenarios} totalValue={account?.totalValue || 0} />
        </div>
        <div className="border border-zinc-800 bg-zinc-950 p-2">
           <div className="flex items-center gap-2 mb-3">
              <PieChart className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sector Exposure</span>
           </div>
           <SectorChart data={sectorData} />
        </div>
      </div>

      {/* Collar Manager */}
      <div className="border border-zinc-800 bg-zinc-950 p-3">
        <div className="flex items-center gap-2 mb-2">
           <ShieldAlert className="h-3 w-3 terminal-amber" />
           <span className="text-[10px] font-black terminal-amber uppercase tracking-widest">Dynamic Protection Engine</span>
        </div>
        <p className="text-[9px] text-zinc-500 mb-3 uppercase font-bold italic tracking-tight">Active_Hedging // Index_Collar_Optimization</p>
        <div className="flex h-20 items-center justify-center border border-dashed border-zinc-800 bg-black/40">
          <p className="text-[10px] font-bold text-zinc-700 uppercase">WAITING_FOR_DATA_FEED...</p>
        </div>
      </div>
    </div>
  );
}
