'use client';

import type { QueueItemWithCandidate } from '@/lib/db';
import { useStreamStore } from '@/lib/store';
import { Minus, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className={cn(
      "group flex items-center gap-5 border bg-black p-4 transition-colors hover:bg-zinc-900/30 rounded-sm",
      priceAlert ? "border-amber-900/50 bg-amber-950/10" : "border-zinc-800"
    )}>
      {/* Symbol + Meta */}
      <div className="min-w-[140px] border-r border-zinc-800 pr-5">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-white tracking-tight">{item.symbol}</span>
          <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 rounded-sm">{item.strategy}</span>
        </div>
        <div className="mt-1.5 text-xs text-zinc-500">
          ${item.strike.toFixed(2)} • {item.expiry}
        </div>
      </div>

      {/* Exposure Metrics */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-r border-zinc-800 pr-6 min-w-[160px]">
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-600">Premium</span>
          <span className="text-sm terminal-green">${(item.premium * 100 * item.quantity).toFixed(0)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-600">Risk</span>
          <span className="text-sm terminal-red">${(item.max_loss * item.quantity).toLocaleString()}</span>
        </div>
      </div>

      {/* Live Data Feed */}
      <div className="flex flex-col min-w-[120px]">
        <span className="text-[10px] text-zinc-600">Underlying px</span>
        {livePrice ? (
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-sm", priceAlert ? "text-amber-500" : "text-zinc-200")}>
              ${livePrice.toFixed(2)}
            </span>
            {priceAlert && <AlertTriangle className="h-3 w-3 text-amber-500 animate-pulse" />}
            <span className={cn("text-xs ml-1", priceDiff! >= 0 ? "terminal-green" : "terminal-red")}>
              {priceDiff! >= 0 ? '▲' : '▼'}{Math.abs(priceDiff!).toFixed(2)}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-zinc-700 animate-pulse mt-0.5">Waiting...</span>
        )}
      </div>

      {/* QTY Control */}
      <div className="flex items-center gap-3 border-l border-zinc-800 pl-5">
        <span className="text-[10px] text-zinc-600">Qty</span>
        <div className="flex items-center border border-zinc-800 bg-zinc-950 rounded-sm overflow-hidden">
          <button
            onClick={() => onQuantityChange(item.queue_id, Math.max(1, item.quantity - 1))}
            className="flex h-7 w-7 items-center justify-center text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-sm font-medium text-white">{item.quantity}</span>
          <button
            onClick={() => onQuantityChange(item.queue_id, item.quantity + 1)}
            className="flex h-7 w-7 items-center justify-center text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* REMOVE ACTION */}
      <button
        onClick={() => onRemove(item.queue_id)}
        className="ml-auto flex h-9 w-9 items-center justify-center text-zinc-600 hover:bg-red-500/10 hover:text-red-400 transition-all rounded-sm border border-transparent hover:border-red-500/20"
        title="Remove order"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
