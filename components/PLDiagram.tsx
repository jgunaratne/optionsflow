'use client';

import { ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, Area, AreaChart } from 'recharts';

interface PLDiagramProps {
  strike: number;
  premium: number;
  strategy: string;
  longStrike?: number;
}

export default function PLDiagram({ strike, premium, strategy, longStrike }: PLDiagramProps) {
  const premiumPerContract = premium * 100;
  const data: Array<{ price: number; pnl: number }> = [];

  const lowerBound = strike * 0.8;
  const upperBound = strike * 1.2;
  const step = (upperBound - lowerBound) / 100;

  for (let price = lowerBound; price <= upperBound; price += step) {
    let pnl: number;
    if (strategy === 'BULL_PUT_SPREAD' && longStrike) {
      if (price >= strike) pnl = premiumPerContract;
      else if (price <= longStrike) pnl = -((strike - longStrike) * 100 - premiumPerContract);
      else pnl = (price - strike) * 100 + premiumPerContract;
    } else {
      // CSP
      if (price >= strike) pnl = premiumPerContract;
      else pnl = (price - strike) * 100 + premiumPerContract;
    }
    data.push({ price: Math.round(price * 100) / 100, pnl: Math.round(pnl) });
  }

  const breakeven = strike - premium;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="price" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
          <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: 12 }}
            labelFormatter={(v) => `Price: $${v}`}
            formatter={(value: unknown) => [`$${value}`, 'P&L']}
          />
          <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />
          <ReferenceLine x={breakeven} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `BE: $${breakeven.toFixed(2)}`, position: 'top', fill: '#f59e0b', fontSize: 10 }} />
          <Area type="monotone" dataKey="pnl" stroke="#34d399" fill="url(#profitGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
