'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

interface Position {
  symbol: string;
  dayPnL: number;
}

interface PositionsChartProps {
  positions: Position[];
}

export default function PositionsChart({ positions }: PositionsChartProps) {
  if (positions.length === 0) {
    return null;
  }

  // Aggregate by underlying symbol if there are multiple options for one symbol
  const aggregated = positions.reduce((acc, pos) => {
    if (!acc[pos.symbol]) {
      acc[pos.symbol] = { symbol: pos.symbol, dayPnL: 0 };
    }
    acc[pos.symbol].dayPnL += pos.dayPnL;
    return acc;
  }, {} as Record<string, { symbol: string; dayPnL: number }>);

  // Sort by PnL
  const data = Object.values(aggregated).sort((a, b) => b.dayPnL - a.dayPnL);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
    if (active && payload && payload.length) {
      const pnl = payload[0].value;
      const isPositive = pnl >= 0;
      return (
        <div className="rounded border border-zinc-800 bg-zinc-900/90 p-3 shadow-xl backdrop-blur-sm">
          <p className="mb-1 text-sm font-bold text-white">{label}</p>
          <p className="text-xs text-zinc-300">
            Day P&L: <span className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>${pnl.toFixed(2)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded border border-white/10 bg-zinc-900/40 p-4 backdrop-blur-sm shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-200 tracking-tight">Day P&L by Symbol</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Aggregated performance across equities and options</p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis 
              dataKey="symbol" 
              stroke="#52525b"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#52525b' }}
            />
            <YAxis 
              stroke="#52525b"
              tickFormatter={(val) => `$${val}`}
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff05' }} />
            <ReferenceLine y={0} stroke="#52525b" />
            <Bar dataKey="dayPnL" radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.dayPnL >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}