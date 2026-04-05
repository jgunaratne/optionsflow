'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useStreamStore, useBrokerStore } from '@/lib/store';
import { useSSE } from '@/lib/useSSE';
import { Activity, Shield, LayoutGrid, MessageSquare, BarChart2, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const BROKER_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  schwab: { label: 'Schwab', icon: 'S', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
  webull: { label: 'Webull', icon: 'W', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30' },
};

function BrokerSwitcher() {
  const { active, supported, switching, fetchBroker, switchBroker } = useBrokerStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchBroker(); }, [fetchBroker]);

  // Close on outside click
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
          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all hover:brightness-110",
          meta.bg,
          switching ? 'opacity-50 cursor-not-allowed' : ''
        )}
      >
        <div className={cn("flex h-5 w-5 items-center justify-center rounded bg-black/20 text-[10px] font-bold shadow-sm", meta.color)}>
          {meta.icon}
        </div>
        <span className={cn("hidden sm:block", meta.color)}>{meta.label}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", meta.color, open ? "rotate-180" : "")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-2xl shadow-black/50 p-1">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Switch Broker
          </div>
          <div className="flex flex-col gap-1">
            {supported.map(broker => {
              const m = BROKER_META[broker] || { label: broker, icon: '?', color: 'text-zinc-400', bg: '' };
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
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  )}
                >
                  <div className={cn("flex h-6 w-6 items-center justify-center rounded bg-black/40 text-[10px] font-bold", m.color)}>
                    {m.icon}
                  </div>
                  <span className="flex-1 font-medium">{m.label}</span>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
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
    marketStatus.status === 'OPEN' ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]' :
    marketStatus.status === 'PRE_MARKET' ? 'bg-blue-400' :
    marketStatus.status === 'AFTER_HOURS' ? 'bg-amber-400' :
    'bg-zinc-600';

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/60 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="hidden text-xl font-bold tracking-tight text-white sm:block">
              OptionsFlow
            </span>
          </Link>
        </div>

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
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-zinc-400")} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-4">
          <BrokerSwitcher />

          {/* VIX Badge */}
          <div className={cn("hidden sm:flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md", vixBg)}>
            <span className="text-zinc-400 uppercase tracking-wider text-[10px]">VIX</span>
            <span className={vixColor}>{vix > 0 ? vix.toFixed(2) : '—'}</span>
          </div>

          {/* Market Status */}
          <div className="flex items-center gap-2 rounded-full border border-white/5 bg-black/20 px-3 py-1.5 text-xs backdrop-blur-md">
            <div className={cn("h-2 w-2 rounded-full", statusDot)} />
            <span className={cn("font-medium tracking-wide", statusColor)}>
              {marketStatus.status.replace('_', ' ')}
            </span>
          </div>

          {/* Mobile Menu Icon (Placeholder) */}
          <div className="md:hidden flex items-center">
            <div className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-400" : "bg-red-400")} />
          </div>
        </div>
      </div>
    </nav>
  );
}
