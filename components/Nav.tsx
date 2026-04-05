'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useStreamStore, useBrokerStore } from '@/lib/store';
import { useSSE } from '@/lib/useSSE';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const BROKER_META: Record<string, { label: string; color: string; bg: string }> = {
  schwab: { label: 'Schwab', color: 'text-blue-400', bg: 'border-blue-900 bg-blue-950/20' },
  webull: { label: 'Webull', color: 'text-orange-400', bg: 'border-orange-900 bg-orange-950/20' },
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
          "flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium transition-all",
          meta.bg,
          switching ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800/50'
        )}
      >
        <span className={meta.color}>{meta.label}</span>
        <ChevronDown className={cn("h-3 w-3", meta.color, open ? "rotate-180" : "")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-32 border border-zinc-800 bg-black p-1 shadow-2xl">
          {supported.map(broker => {
            const m = BROKER_META[broker] || { label: broker.charAt(0).toUpperCase() + broker.slice(1), color: 'text-zinc-400', bg: '' };
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
                  "flex w-full items-center justify-between px-2 py-1.5 text-left text-xs font-medium transition-colors",
                  isActive ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                )}
              >
                <span>{m.label}</span>
                {isActive && <Check className="h-3 w-3 text-primary" />}
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
    { href: '/', label: 'Screener' },
    { href: '/queue', label: 'Queue' },
    { href: '/positions', label: 'Positions' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/chat', label: 'Chat' },
  ];

  const vixColor = vix < 20 ? 'terminal-green' : vix < 30 ? 'terminal-amber' : 'terminal-red';

  const statusColor =
    marketStatus.status === 'OPEN' ? 'terminal-green' :
    marketStatus.status === 'PRE_MARKET' ? 'text-blue-400' :
    marketStatus.status === 'AFTER_HOURS' ? 'terminal-amber' :
    'text-zinc-600';

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-black">
      <div className="flex h-12 w-full items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center bg-primary text-[10px] font-bold text-black">
              OF
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              OptionsFlow
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {links.map(link => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 text-xs transition-colors rounded-sm",
                    isActive
                      ? "bg-zinc-900 text-white font-medium"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-5 h-full">
          {/* Market Status */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-600">Mkt:</span>
            <span className={cn(statusColor)}>
              {marketStatus.status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            <div className={cn("h-1.5 w-1.5 rounded-full ml-1", connected ? "bg-emerald-500" : "bg-red-500")} />
          </div>

          {/* VIX */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-zinc-600">VIX:</span>
            <span className={vixColor}>{vix > 0 ? vix.toFixed(2) : '—'}</span>
          </div>

          <BrokerSwitcher />
        </div>
      </div>
    </nav>
  );
}
