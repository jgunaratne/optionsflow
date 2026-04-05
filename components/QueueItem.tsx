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
      "group flex items-center gap-4 border bg-black p-3 font-mono transition-colors hover:bg-zinc-900/50",
      priceAlert ? "border-terminal-amber/50 bg-terminal-amber/5" : "border-zinc-800"
    )}>
      {/* Symbol + Meta */}
      <div className="min-w-[140px] border-r border-zinc-800 pr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-white">{item.symbol}</span>
          <span className="bg-zinc-800 px-1 text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">{item.strategy}</span>
        </div>
        <div className="mt-1 text-[10px] font-bold text-zinc-600 uppercase">
          ${item.strike.toFixed(2)} | {item.expiry}
        </div>
      </div>

      {/* Exposure Metrics */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-r border-zinc-800 pr-6">
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-zinc-700 uppercase">Premium</span>
          <span className="text-xs font-black terminal-green">${(item.premium * 100 * item.quantity).toFixed(0)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-zinc-700 uppercase">Risk</span>
          <span className="text-xs font-black terminal-red">${(item.max_loss * item.quantity).toLocaleString()}</span>
        </div>
      </div>

      {/* Live Data Feed */}
      <div className="flex flex-col min-w-[100px]">
        <span className="text-[8px] font-black text-zinc-700 uppercase">Underlying_Px</span>
        {livePrice ? (
          <div className="flex items-center gap-1.5">
            <span className={cn("text-xs font-black", priceAlert ? "terminal-amber" : "text-zinc-300")}>
              ${livePrice.toFixed(2)}
            </span>
            {priceAlert && <AlertTriangle className="h-3 w-3 terminal-amber animate-pulse" />}
            <span className={cn("text-[9px] font-bold", priceDiff! >= 0 ? "terminal-green" : "terminal-red")}>
              {priceDiff! >= 0 ? '▲' : '▼'}{Math.abs(priceDiff!).toFixed(2)}%
            </span>
          </div>
        ) : (
          <span className="text-[10px] font-bold text-zinc-800 uppercase tracking-widest animate-pulse">NO_FEED</span>
        )}
      </div>

      {/* QTY Control */}
      <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
        <span className="text-[8px] font-black text-zinc-700 uppercase vertical-text -rotate-90">QTY</span>
        <div className="flex items-center border border-zinc-800 bg-black">
          <button
            onClick={() => onQuantityChange(item.queue_id, Math.max(1, item.quantity - 1))}
            className="flex h-6 w-6 items-center justify-center text-zinc-600 hover:bg-zinc-900 hover:text-white transition-colors"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-8 text-center text-[11px] font-black text-white">{item.quantity}</span>
          <button
            onClick={() => onQuantityChange(item.queue_id, item.quantity + 1)}
            className="flex h-6 w-6 items-center justify-center text-zinc-600 hover:bg-zinc-900 hover:text-white transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* REMOVE ACTION */}
      <button
        onClick={() => onRemove(item.queue_id)}
        className="ml-auto flex h-8 w-8 items-center justify-center text-zinc-800 hover:bg-terminal-red/10 hover:text-terminal-red transition-all"
        title="PURGE_ORDER"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
