'use client';

import { useEffect, useState } from 'react';
import { useBrokerStore } from '@/lib/store';
import { RefreshCw, Key, AlertTriangle, BarChart3, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import PositionsChart from '@/components/PositionsChart';

interface Position {
  symbol: string;
  optionSymbol: string | null;
  description: string;
  assetType: string;
  putCall: string | null;
  quantity: number;
  averagePrice: number;
  marketValue: number;
  dayPnL: number;
  dayPnLPct: number;
}

type FilterType = 'All' | 'Equity' | 'Option';

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [filter, setFilter] = useState<FilterType>('All');
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [dataSource, setDataSource] = useState<'cache' | 'live' | null>(null);
  const { active } = useBrokerStore();

  const brokerLabel = active.charAt(0).toUpperCase() + active.slice(1);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'schwab-connected') {
        setNeedsAuth(false);
        setError(null);
        fetchPositions(true);
      }
      if (event.data?.type === 'schwab-auth-error') {
        setError(event.data?.message || 'Authorization failed');
        setConnecting(false);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/auth/connect', { method: 'POST' });
      const data = await res.json();

      if (data.redirectURI) {
        window.open(data.redirectURI, 'optionsflow-broker-auth', 'width=640,height=800');
        return;
      }

      if (data.success) {
        setNeedsAuth(false);
        setError(null);
        fetchPositions(true);
      } else {
        setError(data.error || 'Connection failed');
      }
    } catch {
      setError('Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const fetchPositions = async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setNeedsAuth(false);
    try {
      const res = await fetch('/api/positions', { method: refresh ? 'POST' : 'GET' });
      const data = await res.json();
      if (data.error === 'not_authenticated') {
        setNeedsAuth(true);
        setPositions([]);
        setCachedAt(data.cachedAt ?? null);
        setDataSource(data.source ?? null);
        return;
      }
      if (!res.ok) {
        setError(data.message || 'Fetch failed');
        setPositions([]);
        setCachedAt(data.cachedAt ?? null);
        setDataSource(data.source ?? null);
        return;
      }
      setPositions(data.positions || []);
      setCachedAt(data.cachedAt ?? null);
      setDataSource(data.source ?? null);
    } catch {
      setError('Server error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-emerald-400';
    if (pnl < 0) return 'text-red-400';
    return 'text-zinc-400';
  };

  const getTypeBadge = (pos: Position) => {
    if (pos.assetType === 'OPTION' && pos.putCall) {
      return (
        <span className={cn(
          "px-2 py-0.5 text-[10px] rounded-2xl border font-bold uppercase tracking-tight",
          pos.putCall === 'PUT' ? "border-blue-900/50 bg-blue-950/30 text-blue-400" : "border-emerald-900/50 bg-emerald-950/30 text-emerald-400"
        )}>
          {pos.putCall}
        </span>
      );
    }
    if (pos.assetType === 'OPTION') {
      return <span className="border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px] text-zinc-400 rounded-2xl font-bold uppercase tracking-tight">Option</span>;
    }
    return <span className="border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px] text-zinc-400 rounded-2xl font-bold uppercase tracking-tight">Equity</span>;
  };

  const filtered = positions.filter(p => {
    if (filter === 'All') return true;
    if (filter === 'Equity') return p.assetType !== 'OPTION';
    return p.assetType === 'OPTION';
  });

  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalDayPnL = positions.reduce((s, p) => s + p.dayPnL, 0);
  const cacheLabel = cachedAt
    ? `Cached ${new Date(cachedAt * 1000).toLocaleString()}`
    : 'No cached data yet';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Positions</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Cached portfolio data from <span className="text-zinc-300 font-medium">{brokerLabel}</span>
            {dataSource === 'live' ? ' updated just now' : ` · ${cacheLabel}`}
          </p>
        </div>
        <button 
          onClick={() => fetchPositions(true)}
          disabled={refreshing}
          className="flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-white/10 hover:text-white rounded-2xl disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          {refreshing ? `Refreshing ${brokerLabel}` : `Refresh from ${brokerLabel}`}
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center border border-dashed border-white/10 rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-700" />
        </div>
      ) : needsAuth ? (
        <div className="flex h-64 flex-col items-center justify-center gap-6 border border-white/10 bg-white/5 p-8 text-center rounded-2xl backdrop-blur-md shadow-xl">
          <div className="rounded-2xl bg-zinc-900 p-6 border border-white/10 shadow-xl">
             <Key className="h-8 w-8 text-zinc-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">Authentication required</p>
            <p className="text-sm text-zinc-400 mt-1">Link your {brokerLabel} account to refresh and cache portfolio data</p>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-gradient-to-r from-zinc-600 to-zinc-800 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-black/40 transition-all hover:shadow-black/60 hover:-translate-y-0.5 active:translate-y-0 rounded-2xl mt-2"
          >
            {connecting ? 'Connecting...' : `Authorize ${brokerLabel}`}
          </button>
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-5 border border-red-500/10 bg-red-500/5 p-8 text-center rounded-2xl">
          <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
          <p className="text-base font-medium text-red-400">{error}</p>
          {!needsAuth && (
            <button
              onClick={() => fetchPositions(true)}
              disabled={refreshing}
              className="mt-2 flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-white/10 hover:text-white rounded-2xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {refreshing ? `Refreshing ${brokerLabel}` : `Refresh from ${brokerLabel}`}
            </button>
          )}
        </div>
      ) : positions.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-6 border border-dashed border-white/10 bg-white/5 text-zinc-400 rounded-2xl">
          <div className="rounded-2xl bg-zinc-900 p-6 border border-white/10">
            <BarChart3 className="h-10 w-10 opacity-40" />
          </div>
          <span className="text-sm font-medium">No active positions found</span>
        </div>
      ) : (
        <>
          {/* Summary Section */}
          <div className="flex flex-wrap items-center gap-8 bg-white/5 border border-white/10 p-6 rounded-2xl">
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Cash Value</div>
              <div className="text-2xl font-bold text-white mt-1">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="h-10 w-px bg-white/10 hidden sm:block" />
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Day Profit / Loss</div>
              <div className={cn("text-2xl font-bold mt-1 flex items-center gap-2", getPnLColor(totalDayPnL))}>
                ${Math.abs(totalDayPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="h-10 w-px bg-white/10 hidden lg:block" />
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Assets</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">{positions.length}</div>
            </div>
            
            <div className="ml-auto flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                {(['All', 'Equity', 'Option'] as FilterType[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn(
                      "px-4 py-1.5 text-xs font-bold transition-all rounded-lg",
                      filter === f ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}>
                    {f}
                  </button>
                ))}
            </div>
          </div>

          {/* PnL Chart */}
          <PositionsChart positions={filtered} />

          {/* Positions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead>
                <tr className="bg-white/5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/10">
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Quantity</th>
                  <th className="px-6 py-4 text-right">Avg Price</th>
                  <th className="px-6 py-4 text-right">Market Value</th>
                  <th className="px-6 py-4 text-right">Day P&L</th>
                  <th className="px-6 py-4 text-right">Change %</th>
                  <th className="px-6 py-4 hidden lg:table-cell">Asset Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((pos, i) => (
                  <tr key={i} className="group hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{pos.symbol}</td>
                    <td className="px-6 py-4">{getTypeBadge(pos)}</td>
                    <td className="px-6 py-4 text-right font-medium text-zinc-300">{pos.quantity}</td>
                    <td className="px-6 py-4 text-right text-zinc-400 font-medium">${pos.averagePrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-bold text-zinc-100">${pos.marketValue.toFixed(2)}</td>
                    <td className={cn("px-6 py-4 text-right font-bold", getPnLColor(pos.dayPnL))}>
                      {pos.dayPnL >= 0 ? '+' : '-'}${Math.abs(pos.dayPnL).toFixed(2)}
                    </td>
                    <td className={cn("px-6 py-4 text-right font-bold", getPnLColor(pos.dayPnLPct))}>
                      <span className="px-2 py-1 rounded-2xl bg-current/5">
                        {pos.dayPnLPct >= 0 ? '▲' : '▼'} {Math.abs(pos.dayPnLPct).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell text-sm text-zinc-400 font-medium truncate max-w-[200px]">
                      {pos.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
