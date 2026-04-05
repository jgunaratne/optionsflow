'use client';

import type { CrashScenario } from '@/lib/risk';

interface ScenarioTableProps {
  scenarios: CrashScenario[];
  totalValue: number;
}

export default function ScenarioTable({ scenarios, totalValue }: ScenarioTableProps) {
  if (scenarios.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded border border-zinc-800 bg-zinc-900/50">
        <p className="text-sm text-zinc-500">No scenario data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-zinc-800 bg-zinc-900/50">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-300">Crash Scenario Stress Test</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Estimated portfolio impact under market drawdowns</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800/50 text-xs text-zinc-500">
            <th className="px-4 py-2.5 text-left font-medium">Scenario</th>
            <th className="px-4 py-2.5 text-right font-medium">Market Move</th>
            <th className="px-4 py-2.5 text-right font-medium">Est. P&L</th>
            <th className="px-4 py-2.5 text-right font-medium">Portfolio After</th>
            <th className="px-4 py-2.5 text-right font-medium">Drawdown</th>
          </tr>
        </thead>
        <tbody>
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
              <tr key={i} className={`border-b border-zinc-800/30 ${rowBg} transition-colors hover:bg-zinc-800/20`}>
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
