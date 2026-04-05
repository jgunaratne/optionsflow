'use client';

interface LiveBadgeProps {
  price: number;
  change: number;
  alert?: boolean;
}

export default function LiveBadge({ price, change, alert }: LiveBadgeProps) {
  const isPositive = change >= 0;
  const color = isPositive ? 'text-emerald-400' : 'text-red-400';
  const bgColor = alert
    ? 'bg-amber-400/10 border-amber-400/40'
    : isPositive
    ? 'bg-emerald-400/5 border-emerald-400/20'
    : 'bg-red-400/5 border-red-400/20';

  return (
    <div className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 ${bgColor}`}>
      <div className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </div>
      <span className="text-sm font-semibold text-white">${price.toFixed(2)}</span>
      <span className={`text-xs font-medium ${color}`}>
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
}
