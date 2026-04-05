'use client';

interface RiskGaugeProps {
  value: number;
  label: string;
  max?: number;
  thresholds?: { green: number; yellow: number };
}

export default function RiskGauge({ value, label, max = 100, thresholds = { green: 20, yellow: 30 } }: RiskGaugeProps) {
  const pct = Math.min(100, (value / max) * 100);
  const color = value < thresholds.green
    ? 'from-emerald-500 to-emerald-400'
    : value < thresholds.yellow
    ? 'from-amber-500 to-amber-400'
    : 'from-red-500 to-red-400';

  const textColor = value < thresholds.green
    ? 'text-emerald-400'
    : value < thresholds.yellow
    ? 'text-amber-400'
    : 'text-red-400';

  const glowColor = value < thresholds.green
    ? 'shadow-emerald-500/20'
    : value < thresholds.yellow
    ? 'shadow-amber-500/20'
    : 'shadow-red-500/20';

  // SVG arc gauge
  const radius = 56;
  const circumference = Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative inline-flex shadow-lg ${glowColor} rounded-full`}>
        <svg width="140" height="80" viewBox="0 0 140 80">
          {/* Background arc */}
          <path
            d="M 14 70 A 56 56 0 0 1 126 70"
            fill="none"
            stroke="#27272a"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d="M 14 70 A 56 56 0 0 1 126 70"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className={`${color.includes('emerald') ? '[stop-color:#34d399]' : color.includes('amber') ? '[stop-color:#fbbf24]' : '[stop-color:#f87171]'}`} stopColor={value < thresholds.green ? '#34d399' : value < thresholds.yellow ? '#fbbf24' : '#f87171'} />
              <stop offset="100%" className="[stop-color:#818cf8]" stopColor={value < thresholds.green ? '#6ee7b7' : value < thresholds.yellow ? '#fcd34d' : '#fca5a5'} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className={`text-2xl font-bold ${textColor}`}>{value.toFixed(1)}</span>
        </div>
      </div>
      <span className="text-sm font-medium text-zinc-400">{label}</span>
    </div>
  );
}
