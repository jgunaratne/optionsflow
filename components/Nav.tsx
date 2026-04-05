'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useStreamStore, useBrokerStore } from '@/lib/store';
import { useSSE } from '@/lib/useSSE';
import { ChevronDown, Check, Activity, LayoutGrid, BarChart2, Shield, MessageSquare, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

const BROKER_META: Record<string, { label: string; color: string; bg: string }> = {
  schwab: { label: 'Schwab', color: 'text-blue-300', bg: 'border-blue-700/50 bg-blue-900/20' },
  webull: { label: 'Webull', color: 'text-orange-300', bg: 'border-orange-700/50 bg-orange-900/20' },
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
        aria-label="Switch Broker"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-semibold transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black",
          meta.bg,
          switching ? 'opacity-50 cursor-not-allowed' : ''
        )}
      >
        <span className={meta.color}>{meta.label}</span>
        <ChevronDown className={cn("h-4 w-4", meta.color, open ? "rotate-180" : "")} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-white/20 bg-zinc-900 backdrop-blur-xl shadow-2xl p-1">
          {supported.map(broker => {
            const m = BROKER_META[broker] || { label: broker, color: 'text-zinc-200', bg: '' };
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
                  "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white/10",
                  isActive ? "bg-white/15 text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <span>{m.label}</span>
                {isActive && <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />}
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
    { href: '/db', label: 'Database', icon: Database },
  ];

  const vixColor = vix < 20 ? 'text-emerald-400' : vix < 30 ? 'text-amber-400' : 'text-red-400';
  const vixBg = vix < 20 ? 'bg-emerald-900/30 border-emerald-500/30' : vix < 30 ? 'bg-amber-900/30 border-amber-500/30' : 'bg-red-900/30 border-red-500/30';

  const statusColor =
    marketStatus.status === 'OPEN' ? 'text-emerald-400' :
    marketStatus.status === 'PRE_MARKET' ? 'text-blue-300' :
    marketStatus.status === 'AFTER_HOURS' ? 'text-amber-400' :
    'text-zinc-400';

  const statusDot =
    marketStatus.status === 'OPEN' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]' :
    marketStatus.status === 'PRE_MARKET' ? 'bg-blue-400' :
    marketStatus.status === 'AFTER_HOURS' ? 'bg-amber-400' :
    'bg-zinc-500';

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-5 group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black rounded-2xl p-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30 transition-transform group-hover:scale-105">
              <Activity className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white sm:block">
              OptionsFlow
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-2">
            {links.map(link => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary",
                    isActive
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-zinc-400")} aria-hidden="true" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-6">
          {/* Market Status */}
          <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-1.5 text-sm" role="status">
            <div className={cn("h-2 w-2 rounded-2xl-full", statusDot)} aria-hidden="true" />
            <span className={cn("font-bold", statusColor)}>
              {marketStatus.status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>

          {/* VIX */}
          <div className={cn("hidden sm:flex items-center gap-2 rounded-2xl border px-4 py-1.5 text-sm font-bold", vixBg)} aria-label="Volatility Index">
            <span className="text-zinc-300 tracking-wider">VIX</span>
            <span className={vixColor}>{vix > 0 ? vix.toFixed(2) : '—'}</span>
          </div>

          <BrokerSwitcher />
          
          {/* Mobile indicator */}
          <div className={cn("md:hidden h-2.5 w-2.5 rounded-2xl-full", connected ? "bg-emerald-400" : "bg-red-400")} aria-label={connected ? "Connected" : "Disconnected"} />
        </div>
      </div>
    </nav>
  );
}
