'use client';

import { useEffect, useState } from 'react';
import { useBrokerStore } from '@/lib/store';

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

type FilterType = 'ALL' | 'EQUITY' | 'OPTION';

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const { active } = useBrokerStore();

  const brokerLabel = active.charAt(0).toUpperCase() + active.slice(1);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'schwab-connected') {
        setNeedsAuth(false);
        setError(null);
        fetchPositions();
      }
      if (event.data?.type === 'schwab-auth-error') {
        setError(event.data?.message || 'Schwab authorization failed');
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
        const popup = window.open(data.redirectURI, 'optionsflow-broker-auth', 'width=640,height=800');
        if (!popup) {
          setError('Popup blocked. Allow popups for this site and try again.');
          return;
        }
        return;
      }

      if (data.success) {
        setNeedsAuth(false);
        setError(null);
        fetchPositions();
      } else {
        setError(data.error || 'Connection failed');
      }
    } catch {
      setError('Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const fetchPositions = async () => {
    setError(null);
    setNeedsAuth(false);
    try {
      const res = await fetch('/api/positions');
      const data = await res.json();
      if (data.error === 'not_authenticated') {
        setNeedsAuth(true);
        setPositions([]);
        return;
      }
      if (!res.ok) {
        setError(data.message || 'Failed to fetch positions');
        setPositions([]);
        return;
      }
      setPositions(data.positions || []);
    } catch (err) {
      console.error('Failed to fetch positions:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 60000);
    return () => clearInterval(interval);
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
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pos.putCall === 'PUT' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'}`}>
          {pos.putCall}
        </span>
      );
    }
    if (pos.assetType === 'OPTION') {
      return <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-400">OPTION</span>;
    }
    if (pos.assetType === 'ETF') {
      return <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">ETF</span>;
    }
    return <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">EQUITY</span>;
  };

  const filtered = positions.filter(p => {
    if (filter === 'ALL') return true;
    if (filter === 'EQUITY') return p.assetType !== 'OPTION';
    return p.assetType === 'OPTION';
  });

  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalDayPnL = positions.reduce((s, p) => s + p.dayPnL, 0);
  const equityCount = positions.filter(p => p.assetType !== 'OPTION').length;
  const optionCount = positions.filter(p => p.assetType === 'OPTION').length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Positions</h1>
          <p className="text-sm text-zinc-500">Live positions from your broker</p>
        </div>
        <button onClick={fetchPositions} className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700">
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <svg className="h-6 w-6 animate-spin text-violet-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
      ) : needsAuth ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-amber-800/50 bg-amber-900/10">
          <span className="text-4xl">🔑</span>
          <p className="text-sm text-zinc-300">Not connected to <span className="font-semibold text-white">{brokerLabel}</span></p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-600/20 transition-all hover:shadow-orange-600/30 disabled:opacity-50"
          >
            {connecting ? 'Connecting…' : `Connect ${brokerLabel}`}
          </button>
          {active === 'schwab' && (
            <p className="text-center text-xs text-zinc-500">This opens Schwab OAuth in a popup and returns here automatically.</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-800/50 bg-red-900/10">
          <span className="text-4xl">⚠️</span>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30">
          <span className="text-4xl">📊</span>
          <p className="text-sm text-zinc-500">No open positions found.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-xs text-zinc-500">Total Positions</div>
              <div className="text-2xl font-bold text-white">{positions.length}</div>
              <div className="mt-1 text-xs text-zinc-500">{equityCount} equities · {optionCount} options</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-xs text-zinc-500">Market Value</div>
              <div className="text-2xl font-bold text-white">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-xs text-zinc-500">Day P&L</div>
              <div className={`text-2xl font-bold ${getPnLColor(totalDayPnL)}`}>
                {totalDayPnL >= 0 ? '+' : ''}${totalDayPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-xs text-zinc-500">Filter</div>
              <div className="mt-1 flex gap-1">
                {(['ALL', 'EQUITY', 'OPTION'] as FilterType[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${filter === f ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
                    {f === 'ALL' ? 'All' : f === 'EQUITY' ? 'Stocks' : 'Options'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="px-4 py-3 text-left font-medium">Symbol</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Avg Price</th>
                  <th className="px-4 py-3 text-right font-medium">Mkt Value</th>
                  <th className="px-4 py-3 text-right font-medium">Day P&L ($)</th>
                  <th className="px-4 py-3 text-right font-medium">Day P&L (%)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pos, i) => (
                  <tr key={i} className="border-b border-zinc-800/30 transition-colors hover:bg-zinc-800/20">
                    <td className="px-4 py-3 font-semibold text-white">{pos.symbol}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-zinc-400">{pos.description}</td>
                    <td className="px-4 py-3">{getTypeBadge(pos)}</td>
                    <td className="px-4 py-3 text-right text-zinc-200">{pos.quantity}</td>
                    <td className="px-4 py-3 text-right text-zinc-200">${pos.averagePrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-zinc-200">${pos.marketValue.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${getPnLColor(pos.dayPnL)}`}>
                      {pos.dayPnL >= 0 ? '+' : ''}${pos.dayPnL.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${getPnLColor(pos.dayPnLPct)}`}>
                      {pos.dayPnLPct >= 0 ? '+' : ''}{pos.dayPnLPct.toFixed(2)}%
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
