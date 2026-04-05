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
      "group flex items-center gap-4 border bg-zinc-900/40 p-4 transition-all hover:bg-zinc-900/60 rounded backdrop-blur-sm",
      priceAlert ? "border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]" : "border-white/10 shadow-sm"
    )}>
      {/* Symbol + Identity */}
      <div className="min-w-[140px] border-r border-white/10 pr-6">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white tracking-tight">{item.symbol}</span>
          <span className="bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-400 rounded uppercase tracking-tighter">{item.strategy}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
          <span>${item.strike.toFixed(2)}</span>
          <span className="text-zinc-700">•</span>
          <span>{item.expiry}</span>
        </div>
      </div>

      {/* Exposure Metrics */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 border-r border-white/10 pr-8 min-w-[180px]">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Premium</span>
          <span className="text-sm font-bold terminal-green">${(item.premium * 100 * item.quantity).toFixed(0)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Max Risk</span>
          <span className="text-sm font-bold text-red-400">${(item.max_loss * item.quantity).toLocaleString()}</span>
        </div>
      </div>

      {/* Live Data Feed */}
      <div className="flex flex-col min-w-[130px]">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Live Underlying</span>
        {livePrice ? (
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-sm font-bold", priceAlert ? "text-amber-400" : "text-zinc-200")}>
              ${livePrice.toFixed(2)}
            </span>
            {priceAlert && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 animate-pulse" />}
            <div className={cn(
              "flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded", 
              priceDiff! >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            )}>
              {priceDiff! >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {Math.abs(priceDiff!).toFixed(2)}%
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
             <div className="h-1.5 w-1.5 rounded-full bg-zinc-800 animate-pulse" />
             <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">Waiting...</span>
          </div>
        )}
      </div>

      {/* QTY Control */}
      <div className="flex items-center gap-4 border-l border-white/10 pl-6">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Qty</span>
        <div className="flex items-center border border-white/10 bg-black/40 rounded overflow-hidden shadow-inner">
          <button
            onClick={() => onQuantityChange(item.queue_id, Math.max(1, item.quantity - 1))}
            className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-sm font-bold text-white">{item.quantity}</span>
          <button
            onClick={() => onQuantityChange(item.queue_id, item.quantity + 1)}
            className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* REMOVE ACTION */}
      <button
        onClick={() => onRemove(item.queue_id)}
        className="ml-auto flex h-10 w-10 items-center justify-center text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all rounded border border-transparent hover:border-red-500/20 group/trash"
        title="Remove order"
      >
        <Trash2 className="h-5 w-5 transition-transform group-hover/trash:scale-110" />
      </button>
    </div>
  );
}
