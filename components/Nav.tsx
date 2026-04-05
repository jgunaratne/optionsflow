'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useStreamStore, useBrokerStore } from '@/lib/store';
import { useSSE } from '@/lib/useSSE';
import { ChevronDown, Check, Activity, LayoutGrid, BarChart2, Shield, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const BROKER_META: Record<string, { label: string; color: string; bg: string }> = {
  schwab: { label: 'Schwab', color: 'text-blue-400', bg: 'border-blue-900/50 bg-blue-500/10' },
  webull: { label: 'Webull', color: 'text-orange-400', bg: 'border-orange-900/50 bg-orange-500/10' },
};

function BrokerSwitcher() {
  const { active, supported, switching, fetchBroker, switchBroker } = useBrokerStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchBroker(); }, [fetchBroker]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const meta = BROKER_META[active] || BROKER_META.schwab;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:brightness-110",
          meta.bg,
          switching ? 'opacity-50 cursor-not-allowed' : ''
        )}
      >
        <span className={meta.color}>{meta.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5", meta.color, open ? "rotate-180" : "")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-2xl p-1">
          {supported.map(broker => {
            const m = BROKER_META[broker] || { label: broker, color: 'text-zinc-400', bg: '' };
            const isActive = broker === active;
            return (
              <button
                key={broker}
                onClick={async () => {
                  if (isActive) { setOpen(false); return; }
                  const ok = await switchBroker(broker);
                  if (ok) { setOpen(false); window.location.reload(); }
                }}
                disabled={switching}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-all",
                  isActive ? "bg-white/10 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                <span>{m.label}</span>
                {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  useSSE();

  const { vix, marketStatus, connected } = useStreamStore();

  const links = [
    { href: '/', label: 'Screener', icon: Activity },
    { href: '/queue', label: 'Queue', icon: LayoutGrid },
    { href: '/positions', label: 'Positions', icon: BarChart2 },
    { href: '/portfolio', label: 'Portfolio', icon: Shield },
    { href: '/chat', label: 'Chat', icon: MessageSquare },
  ];

  const vixColor = vix < 20 ? 'text-emerald-400' : vix < 30 ? 'text-amber-400' : 'text-red-400';
  const vixBg = vix < 20 ? 'bg-emerald-500/10 border-emerald-500/20' : vix < 30 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  const statusColor =
    marketStatus.status === 'OPEN' ? 'text-emerald-400' :
    marketStatus.status === 'PRE_MARKET' ? 'text-blue-400' :
    marketStatus.status === 'AFTER_HOURS' ? 'text-amber-400' :
    'text-zinc-500';

  const statusDot =
    marketStatus.status === 'OPEN' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.4)]' :
    marketStatus.status === 'PRE_MARKET' ? 'bg-blue-400' :
    marketStatus.status === 'AFTER_HOURS' ? 'bg-amber-400' :
    'bg-zinc-600';

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:px-8">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-indigo-600 shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white sm:block">
              Options<span className="text-primary">Flow</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(link => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-zinc-500")} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-4">
          {/* Market Status */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs">
            <div className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
            <span className={cn("font-medium", statusColor)}>
              {marketStatus.status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>

          {/* VIX */}
          <div className={cn("hidden sm:flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", vixBg)}>
            <span className="text-zinc-500 uppercase tracking-widest text-[9px]">Vix</span>
            <span className={vixColor}>{vix > 0 ? vix.toFixed(2) : '—'}</span>
          </div>

          <BrokerSwitcher />
          
          {/* Mobile indicator */}
          <div className={cn("md:hidden h-2 w-2 rounded-full", connected ? "bg-emerald-400" : "bg-red-400")} />
        </div>
      </div>
    </nav>
  );
}
