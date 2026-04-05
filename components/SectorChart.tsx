'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { SectorExposure } from '@/lib/risk';

interface SectorChartProps {
  data: SectorExposure[];
}

const COLORS = [
  '#2563eb', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e',
  '#eab308', '#f97316', '#ef4444', '#ec4899', '#64748b',
];

export default function SectorChart({ data }: SectorChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/50">
        <p className="text-sm text-zinc-400">No sector data available</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-around gap-6">
      <div className="h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="pct"
              nameKey="sector"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '16px', fontSize: 12 }}
              formatter={(value: unknown) => [`${(Number(value) * 100).toFixed(1)}%`, 'Exposure']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-3 min-w-[120px]">
        {data.map((item, i) => (
          <div key={item.sector} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-2xl-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-zinc-400 font-medium">{item.sector}</span>
            </div>
            <span className="font-bold text-zinc-200">{(item.pct * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
