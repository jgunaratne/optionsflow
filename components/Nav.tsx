'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useStreamStore, useBrokerStore } from '@/lib/store';
import { useSSE } from '@/lib/useSSE';

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
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all hover:brightness-125 ${meta.bg} ${switching ? 'opacity-50' : ''}`}
      >
        <span className={`flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold ${meta.color}`}>
          {meta.icon}
        </span>
        <span className={meta.color}>{meta.label}</span>
        <svg className={`h-3 w-3 transition-transform ${meta.color} ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/40">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Switch Broker
          </div>
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
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-zinc-800/80 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${m.color} bg-zinc-800`}>
                  {m.icon}
                </span>
                <span className="flex-1">{m.label}</span>
                {isActive && (
                  <span className="text-emerald-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
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
    { href: '/', label: 'Screener', icon: '🔍' },
    { href: '/queue', label: 'Queue', icon: '📋' },
    { href: '/positions', label: 'Positions', icon: '📊' },
    { href: '/portfolio', label: 'Portfolio', icon: '🛡️' },
    { href: '/chat', label: 'Chat', icon: '💬' },
  ];

  const vixColor = vix < 20 ? 'text-emerald-400' : vix < 30 ? 'text-amber-400' : 'text-red-400';
  const vixBg = vix < 20 ? 'bg-emerald-400/10 border-emerald-400/30' : vix < 30 ? 'bg-amber-400/10 border-amber-400/30' : 'bg-red-400/10 border-red-400/30';

  const statusColor =
    marketStatus.status === 'OPEN' ? 'text-emerald-400' :
    marketStatus.status === 'PRE_MARKET' ? 'text-blue-400' :
    marketStatus.status === 'AFTER_HOURS' ? 'text-amber-400' :
    'text-zinc-500';

  const statusDot =
    marketStatus.status === 'OPEN' ? 'bg-emerald-400 animate-pulse' :
    marketStatus.status === 'PRE_MARKET' ? 'bg-blue-400' :
    marketStatus.status === 'AFTER_HOURS' ? 'bg-amber-400' :
    'bg-zinc-600';

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
            OF
          </div>
          <span className="hidden text-lg font-semibold tracking-tight text-white sm:block">
            OptionsFlow
          </span>
        </div>

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          {links.map(link => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <span className="text-base">{link.icon}</span>
                <span className="hidden md:inline">{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right side: Broker Switcher + VIX + Market Status */}
        <div className="flex items-center gap-3">
          {/* Broker Switcher */}
          <BrokerSwitcher />

          {/* VIX Badge */}
          <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${vixBg}`}>
            <span className="text-zinc-400">VIX</span>
            <span className={vixColor}>{vix > 0 ? vix.toFixed(1) : '—'}</span>
          </div>

          {/* Market Status */}
          <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs">
            <div className={`h-2 w-2 rounded-full ${statusDot}`} />
            <span className={`font-medium ${statusColor}`}>
              {marketStatus.status.replace('_', ' ')}
            </span>
          </div>

          {/* Connection indicator */}
          <div className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
               title={connected ? 'Connected' : 'Disconnected'} />
        </div>
      </div>
    </nav>
  );
}
