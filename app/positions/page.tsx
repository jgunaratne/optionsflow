'use client';

import { useEffect, useState } from 'react';
import { useBrokerStore } from '@/lib/store';
import { RefreshCw, Key, AlertTriangle, BarChart3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [filter, setFilter] = useState<FilterType>('All');
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
        setError(data.message || 'Fetch failed');
        setPositions([]);
        return;
      }
      setPositions(data.positions || []);
    } catch (err) {
      setError('Server error');
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
    if (pnl > 0) return 'terminal-green';
    if (pnl < 0) return 'terminal-red';
    return 'text-zinc-500';
  };

  const getTypeBadge = (pos: Position) => {
    if (pos.assetType === 'OPTION' && pos.putCall) {
      return (
        <span className={cn(
          "px-2 py-0.5 text-[10px] rounded-sm border",
          pos.putCall === 'PUT' ? "border-blue-900/50 bg-blue-950/30 text-blue-400" : "border-emerald-900/50 bg-emerald-950/30 text-emerald-400"
        )}>
          {pos.putCall === 'PUT' ? 'Put' : 'Call'}
        </span>
      );
    }
    if (pos.assetType === 'OPTION') {
      return <span className="border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px] text-zinc-400 rounded-sm">Option</span>;
    }
    return <span className="border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px] text-zinc-500 rounded-sm">Equity</span>;
  };

  const filtered = positions.filter(p => {
    if (filter === 'All') return true;
    if (filter === 'Equity') return p.assetType !== 'OPTION';
    return p.assetType === 'OPTION';
  });

  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalDayPnL = positions.reduce((s, p) => s + p.dayPnL, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mt-2">
        <div>
          <h1 className="text-xl font-medium text-white tracking-tight">Portfolio positions</h1>
          <p className="text-xs text-zinc-500 mt-1">Live feed from {brokerLabel}</p>
        </div>
        <button 
          onClick={fetchPositions} 
          className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/30 px-4 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white rounded-sm"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center border border-dashed border-zinc-800 rounded-sm">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </div>
      ) : needsAuth ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4 border border-zinc-800 bg-zinc-950/50 p-6 text-center rounded-sm">
          <Key className="h-8 w-8 text-zinc-600" />
          <div>
            <p className="text-sm font-medium text-zinc-300">Authentication required</p>
            <p className="text-xs text-zinc-500 mt-1">Link your {brokerLabel} account to view live data</p>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="border border-primary/50 bg-primary/10 px-6 py-2 text-xs text-primary transition-all hover:bg-primary hover:text-black disabled:opacity-50 rounded-sm mt-2"
          >
            {connecting ? 'Connecting...' : `Connect ${brokerLabel}`}
          </button>
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 border border-red-900/30 bg-red-950/20 p-4 text-center rounded-sm">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 border border-dashed border-zinc-800 text-zinc-600 rounded-sm">
          <BarChart3 className="h-8 w-8 opacity-40 mb-2" />
          <span className="text-sm">No active positions</span>
        </div>
      ) : (
        <>
          {/* Summary Row */}
          <div className="grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-4 rounded-sm overflow-hidden">
            <div className="bg-black p-4">
              <div className="text-xs text-zinc-500">Market value</div>
              <div className="text-lg text-white mt-1">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-black p-4">
              <div className="text-xs text-zinc-500">Day P&L</div>
              <div className={cn("text-lg mt-1", getPnLColor(totalDayPnL))}>
                {totalDayPnL >= 0 ? '+' : ''}${totalDayPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-black p-4">
              <div className="text-xs text-zinc-500">Positions</div>
              <div className="text-lg text-zinc-300 mt-1">{positions.length}</div>
            </div>
            <div className="bg-black p-4 flex flex-col justify-center">
              <div className="flex gap-1.5">
                {(['All', 'Equity', 'Option'] as FilterType[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 py-1 text-xs transition-colors border rounded-sm",
                      filter === f ? "border-primary bg-primary/10 text-primary" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                    )}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="border border-zinc-800 rounded-sm overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead>
                <tr className="bg-zinc-900/40 text-zinc-500 border-b border-zinc-800">
                  <th className="px-4 py-3 font-normal">Symbol</th>
                  <th className="px-4 py-3 font-normal">Type</th>
                  <th className="px-4 py-3 font-normal text-right">Qty</th>
                  <th className="px-4 py-3 font-normal text-right">Avg px</th>
                  <th className="px-4 py-3 font-normal text-right">Mkt val</th>
                  <th className="px-4 py-3 font-normal text-right">Day P&L</th>
                  <th className="px-4 py-3 font-normal text-right">Day %</th>
                  <th className="px-4 py-3 font-normal hidden lg:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((pos, i) => (
                  <tr key={i} className="bg-black transition-colors hover:bg-zinc-900/30">
                    <td className="px-4 py-2.5 font-medium text-zinc-100">{pos.symbol}</td>
                    <td className="px-4 py-2.5">{getTypeBadge(pos)}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-300">{pos.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-400">${pos.averagePrice.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-200">${pos.marketValue.toFixed(2)}</td>
                    <td className={cn("px-4 py-2.5 text-right", getPnLColor(pos.dayPnL))}>
                      {pos.dayPnL >= 0 ? '+' : ''}${pos.dayPnL.toFixed(2)}
                    </td>
                    <td className={cn("px-4 py-2.5 text-right", getPnLColor(pos.dayPnLPct))}>
                      {pos.dayPnLPct >= 0 ? '+' : ''}{pos.dayPnLPct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-zinc-500 truncate max-w-[250px]">
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
