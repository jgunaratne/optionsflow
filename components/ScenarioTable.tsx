'use client';

import type { CrashScenario } from '@/lib/risk';

interface ScenarioTableProps {
  scenarios: CrashScenario[];
  totalValue: number;
}

export default function ScenarioTable({ scenarios, totalValue }: ScenarioTableProps) {
  if (scenarios.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/50">
        <p className="text-sm text-zinc-400">No scenario data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-zinc-200">Crash Scenario Stress Test</h3>
        <p className="text-sm text-zinc-400 mt-0.5">Estimated portfolio impact under market drawdowns</p>
      </div>
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-white/10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <th className="px-4 py-3 font-medium">Scenario</th>
            <th className="px-4 py-3 text-right font-medium">Market Move</th>
            <th className="px-4 py-3 text-right font-medium">Est. P&L</th>
            <th className="px-4 py-3 text-right font-medium">Portfolio After</th>
            <th className="px-4 py-3 text-right font-medium">Drawdown</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {scenarios.map((scenario, i) => {
            const drawdown = totalValue > 0
              ? ((scenario.portfolioValueAfter - totalValue) / totalValue) * 100
              : 0;
            const severity = Math.abs(scenario.marketMove);
            const rowBg = severity >= 0.5
              ? 'bg-red-500/5'
              : severity >= 0.3
              ? 'bg-red-500/3'
              : '';

            return (
              <tr key={i} className={`${rowBg} transition-colors hover:bg-white/5`}>
                <td className="px-4 py-3 font-medium text-zinc-200">{scenario.label}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-400">
                  {(scenario.marketMove * 100).toFixed(0)}%
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${scenario.estimatedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {scenario.estimatedPnL >= 0 ? '+' : ''}${scenario.estimatedPnL.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  ${scenario.portfolioValueAfter.toLocaleString()}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${drawdown >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {drawdown >= 0 ? '+' : ''}{drawdown.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
