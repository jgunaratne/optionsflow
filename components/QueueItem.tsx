'use client';

import type { QueueItemWithCandidate } from '@/lib/db';
import { useStreamStore } from '@/lib/store';
import LiveBadge from './LiveBadge';

interface QueueItemProps {
  item: QueueItemWithCandidate;
  onRemove: (id: number) => void;
  onQuantityChange: (id: number, quantity: number) => void;
}

export default function QueueItem({ item, onRemove, onQuantityChange }: QueueItemProps) {
  const { quotes } = useStreamStore();
  const livePrice = quotes[item.symbol]?.lastPrice || quotes[item.symbol]?.mark;
  const priceWhenQueued = item.underlying_price;
  const priceDiff = livePrice ? ((livePrice - priceWhenQueued) / priceWhenQueued) * 100 : null;
  const priceAlert = priceDiff !== null && Math.abs(priceDiff) > 2;

  return (
    <div className={`group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-all hover:bg-zinc-900 ${priceAlert ? 'border-amber-500/40' : ''}`}>
      {/* Symbol + Strategy */}
      <div className="min-w-[120px]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{item.symbol}</span>
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/30">
            {item.strategy}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          ${item.strike.toFixed(2)} • {item.expiry}
        </div>
      </div>

      {/* Premium */}
      <div className="text-center">
        <div className="text-xs text-zinc-500">Premium</div>
        <div className="text-sm font-semibold text-emerald-400">
          ${(item.premium * 100 * item.quantity).toFixed(0)}
        </div>
      </div>

      {/* Max Loss */}
      <div className="text-center">
        <div className="text-xs text-zinc-500">Max Loss</div>
        <div className="text-sm font-semibold text-red-400">
          ${(item.max_loss * item.quantity).toLocaleString()}
        </div>
      </div>

      {/* Live Price */}
      <div className="text-center">
        <div className="text-xs text-zinc-500">Underlying</div>
        {livePrice ? (
          <LiveBadge price={livePrice} change={priceDiff || 0} alert={priceAlert} />
        ) : (
          <div className="text-sm text-zinc-600">—</div>
        )}
      </div>

      {/* Quantity Stepper */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onQuantityChange(item.queue_id, Math.max(1, item.quantity - 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          −
        </button>
        <span className="w-8 text-center text-sm font-semibold text-white">{item.quantity}</span>
        <button
          onClick={() => onQuantityChange(item.queue_id, item.quantity + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          +
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.queue_id)}
        className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/10 hover:text-red-300"
      >
        Remove
      </button>
    </div>
  );
}
