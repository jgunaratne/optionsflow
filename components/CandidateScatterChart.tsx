'use client';

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis } from 'recharts';
import { Candidate } from '@/lib/db';

interface CandidateScatterChartProps {
  candidates: Candidate[];
}

export default function CandidateScatterChart({ candidates }: CandidateScatterChartProps) {
  if (candidates.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded border border-dashed border-white/10 bg-white/5 text-zinc-500">
        <p className="text-sm">No data to display</p>
      </div>
    );
  }

  // Filter out any bizarre outliers if necessary, but assuming clean data
  const data = candidates.map(c => ({
    ...c,
    // ensure values are numbers
    pop: Number(c.pop),
    premium: Number(c.premium),
    ai_score: Number(c.ai_score),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded border border-zinc-800 bg-zinc-900/90 p-3 shadow-xl backdrop-blur-sm">
          <p className="mb-1 text-sm font-bold text-white">{data.symbol} <span className="text-xs font-normal text-zinc-400">({data.strategy})</span></p>
          <p className="text-xs text-zinc-300">POP: <span className="font-semibold text-emerald-400">{data.pop.toFixed(1)}%</span></p>
          <p className="text-xs text-zinc-300">Premium: <span className="font-semibold text-white">${data.premium.toFixed(2)}</span></p>
          <p className="text-xs text-zinc-300">AI Score: <span className="font-semibold text-blue-400">{data.ai_score}/100</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded border border-white/10 bg-zinc-900/40 p-4 backdrop-blur-sm shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-200 tracking-tight">Risk / Reward Distribution</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Probability of Profit vs. Premium Collected</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-400" /> High AI</div>
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-amber-400" /> Med AI</div>
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-red-400" /> Low AI</div>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis 
              type="number" 
              dataKey="pop" 
              name="POP" 
              domain={['auto', 'auto']} 
              tickFormatter={(val) => `${val}%`}
              stroke="#52525b"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              tickLine={{ stroke: '#52525b' }}
            />
            <YAxis 
              type="number" 
              dataKey="premium" 
              name="Premium" 
              tickFormatter={(val) => `$${val}`}
              stroke="#52525b"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              tickLine={{ stroke: '#52525b' }}
            />
            <ZAxis type="number" dataKey="ai_score" range={[40, 150]} name="AI Score" />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#ffffff20' }} />
            <Scatter name="Candidates" data={data}>
              {data.map((entry, index) => {
                const isGreen = entry.ai_flag === 'GREEN';
                const isYellow = entry.ai_flag === 'YELLOW';
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={isGreen ? '#34d399' : isYellow ? '#fbbf24' : '#f87171'} 
                    fillOpacity={0.7}
                    stroke={isGreen ? '#059669' : isYellow ? '#b45309' : '#b91c1c'}
                    strokeWidth={1}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}