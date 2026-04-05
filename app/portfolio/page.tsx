'use client';

import { useEffect } from 'react';
import ScenarioTable from '@/components/ScenarioTable';
import SectorChart from '@/components/SectorChart';
import RiskGauge from '@/components/RiskGauge';
import { useStreamStore, useAccountStore } from '@/lib/store';
import { calculateCapitalAllocation, type CrashScenario, type SectorExposure } from '@/lib/risk';

export default function PortfolioPage() {
  const { vix } = useStreamStore();
  const { account, fetchAccount } = useAccountStore();
  const greeks = { totalDelta: 0, totalTheta: 0, totalVega: 0 };
  const scenarios: CrashScenario[] = [];
  const sectorData: SectorExposure[] = [];

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  // In a full implementation, these would come from the positions API
  const allocation = account
    ? calculateCapitalAllocation(account.totalValue, account.deployedCapital)
    : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Portfolio Risk</h1>
        <p className="text-sm text-zinc-500">Risk overview and stress testing</p>
      </div>

      {/* Top gauges */}
      <div className="mb-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div className="flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <RiskGauge value={vix || 0} label="VIX" max={50} thresholds={{ green: 20, yellow: 30 }} />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
          <div className="text-xs text-zinc-500">Total Value</div>
          <div className="mt-2 text-2xl font-bold text-white">${(account?.totalValue || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
          <div className="text-xs text-zinc-500">Buying Power</div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">${(account?.buyingPower || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
          <div className="text-xs text-zinc-500">Deployed</div>
          <div className={`mt-2 text-2xl font-bold ${(account?.deployedPct || 0) > 0.5 ? 'text-red-400' : 'text-amber-400'}`}>
            {((account?.deployedPct || 0) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Greeks */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Net Portfolio Greeks</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
            <div className="text-xs text-zinc-500">Delta (Δ)</div>
            <div className="text-xl font-bold text-white">{greeks.totalDelta.toFixed(1)}</div>
          </div>
          <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
            <div className="text-xs text-zinc-500">Theta (Θ)</div>
            <div className="text-xl font-bold text-emerald-400">+${greeks.totalTheta.toFixed(2)}</div>
            <div className="text-xs text-zinc-500">per day</div>
          </div>
          <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
            <div className="text-xs text-zinc-500">Vega (ν)</div>
            <div className="text-xl font-bold text-white">{greeks.totalVega.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Capital Allocation */}
      {allocation && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">Capital Allocation</h3>
          <div className="mb-3 flex h-6 overflow-hidden rounded-full bg-zinc-800">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-700" style={{ width: `${allocation.deployedPct * 100}%` }} />
            <div className="bg-emerald-600/50 transition-all duration-700" style={{ width: `${allocation.availablePct * 100}%` }} />
            <div className="bg-zinc-700 transition-all duration-700" style={{ width: `${allocation.bufferPct * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" /> Deployed: ${allocation.deployed.toLocaleString()} ({(allocation.deployedPct * 100).toFixed(1)}%)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600/50" /> Available: ${allocation.available.toLocaleString()} ({(allocation.availablePct * 100).toFixed(1)}%)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-zinc-700" /> Buffer: ${allocation.buffer.toLocaleString()} ({(allocation.bufferPct * 100).toFixed(1)}%)</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ScenarioTable scenarios={scenarios} totalValue={account?.totalValue || 0} />
        <SectorChart data={sectorData} />
      </div>

      {/* Collar Manager */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Collar Manager</h3>
        <p className="text-xs text-zinc-500 mb-3">Recommended collar structures for index positions (sell 5% OTM call + buy 10% OTM put)</p>
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-zinc-700">
          <p className="text-sm text-zinc-500">Connect your broker to see collar recommendations for SPY, QQQ, and IVV positions</p>
        </div>
      </div>
    </div>
  );
}
