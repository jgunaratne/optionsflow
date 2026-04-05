'use client';

import type { QueueItemWithCandidate } from '@/lib/db';
import { useStreamStore } from '@/lib/store';
import { Minus, Plus, Trash2, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
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
      "group flex flex-wrap lg:flex-nowrap items-center justify-between gap-6 bg-zinc-900/20 p-5 transition-all hover:bg-zinc-900/40 rounded-2xl",
      priceAlert ? "border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]" : "border border-white/5"
    )}>
      {/* Symbol + Identity */}
      <div className="min-w-[140px]">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white tracking-tight">{item.symbol}</span>
          <span className="bg-white/5 px-2 py-0.5 text-[10px] font-bold text-zinc-400 rounded-2xl uppercase tracking-tighter">{item.strategy}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
          <span>${item.strike.toFixed(2)}</span>
          <span className="text-zinc-700">•</span>
          <span>{item.expiry}</span>
        </div>
      </div>

      {/* Exposure Metrics */}
      <div className="flex gap-8">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cash Earned</span>
          <span className="text-sm font-bold text-emerald-400">${(item.premium * 100 * item.quantity).toFixed(0)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Max Risk</span>
          <span className="text-sm font-bold text-zinc-200">${(item.max_loss * item.quantity).toLocaleString()}</span>
        </div>
      </div>

      {/* Live Data Feed */}
      <div className="flex flex-col min-w-[130px]">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Live Underlying</span>
        {livePrice ? (
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-sm font-bold", priceAlert ? "text-amber-400" : "text-zinc-200")}>
              ${livePrice.toFixed(2)}
            </span>
            {priceAlert && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 animate-pulse" />}
            <div className={cn(
              "flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-2xl", 
              priceDiff! >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            )}>
              {priceDiff! >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {Math.abs(priceDiff!).toFixed(2)}%
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
             <div className="h-1.5 w-1.5 rounded-full bg-zinc-800 animate-pulse" />
             <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Waiting...</span>
          </div>
        )}
      </div>

      {/* QTY Control */}
      <div className="flex items-center gap-6">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider hidden sm:block">Qty</span>
        <div className="flex items-center bg-black/20 rounded-lg overflow-hidden border border-white/5">
          <button
            onClick={() => onQuantityChange(item.queue_id, Math.max(1, item.quantity - 1))}
            className="flex h-8 w-8 items-center justify-center text-zinc-500 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-bold text-white">{item.quantity}</span>
          <button
            onClick={() => onQuantityChange(item.queue_id, item.quantity + 1)}
            className="flex h-8 w-8 items-center justify-center text-zinc-500 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* REMOVE ACTION */}
      <button
        onClick={() => onRemove(item.queue_id)}
        className="flex h-10 w-10 items-center justify-center text-zinc-600 hover:bg-red-500/10 hover:text-red-400 transition-all rounded-lg group/trash"
        title="Remove order"
      >
        <Trash2 className="h-4 w-4 transition-transform group-hover/trash:scale-110" />
      </button>
    </div>
  );
}
