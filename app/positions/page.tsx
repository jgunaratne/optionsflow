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
    } catch {
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
    if (pnl > 0) return 'text-emerald-400';
    if (pnl < 0) return 'text-red-400';
    return 'text-zinc-400';
  };

  const getTypeBadge = (pos: Position) => {
    if (pos.assetType === 'OPTION' && pos.putCall) {
      return (
        <span className={cn(
          "px-2 py-0.5 text-[10px] rounded border font-bold uppercase tracking-tight",
          pos.putCall === 'PUT' ? "border-blue-900/50 bg-blue-950/30 text-blue-400" : "border-emerald-900/50 bg-emerald-950/30 text-emerald-400"
        )}>
          {pos.putCall}
        </span>
      );
    }
    if (pos.assetType === 'OPTION') {
      return <span className="border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px] text-zinc-400 rounded font-bold uppercase tracking-tight">Option</span>;
    }
    return <span className="border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px] text-zinc-400 rounded font-bold uppercase tracking-tight">Equity</span>;
  };

  const filtered = positions.filter(p => {
    if (filter === 'All') return true;
    if (filter === 'Equity') return p.assetType !== 'OPTION';
    return p.assetType === 'OPTION';
  });

  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalDayPnL = positions.reduce((s, p) => s + p.dayPnL, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Positions</h1>
          <p className="text-sm text-zinc-400 mt-1">Real-time data feed from <span className="text-zinc-300 font-medium">{brokerLabel}</span></p>
        </div>
        <button 
          onClick={fetchPositions} 
          className="flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-white/10 hover:text-white rounded"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Feed
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center border border-dashed border-white/10 rounded">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-700" />
        </div>
      ) : needsAuth ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4 border border-white/10 bg-white/5 p-8 text-center rounded backdrop-blur-sm">
          <div className="rounded bg-zinc-900 p-4 border border-white/10 shadow-xl">
             <Key className="h-8 w-8 text-zinc-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">Authentication required</p>
            <p className="text-sm text-zinc-400 mt-1">Link your {brokerLabel} account to view live portfolio data</p>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-gradient-to-r from-primary to-blue-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 rounded mt-2"
          >
            {connecting ? 'Connecting...' : `Authorize ${brokerLabel}`}
          </button>
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 border border-red-500/10 bg-red-500/5 p-8 text-center rounded">
          <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
          <p className="text-base font-medium text-red-400">{error}</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4 border border-dashed border-white/10 bg-white/5 text-zinc-400 rounded">
          <div className="rounded bg-zinc-900 p-4 border border-white/10">
            <BarChart3 className="h-10 w-10 opacity-40" />
          </div>
          <span className="text-sm font-medium">No active positions found</span>
        </div>
      ) : (
        <>
          {/* Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-900/40 border border-white/10 p-4 rounded backdrop-blur-sm shadow-sm">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Net Liquidity</div>
              <div className="text-2xl font-bold text-white mt-1.5">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-zinc-900/40 border border-white/10 p-4 rounded backdrop-blur-sm shadow-sm">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Day Profit / Loss</div>
              <div className={cn("text-2xl font-bold mt-1.5 flex items-center gap-2", getPnLColor(totalDayPnL))}>
                {totalDayPnL >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                ${Math.abs(totalDayPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-zinc-900/40 border border-white/10 p-4 rounded backdrop-blur-sm shadow-sm">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Active Assets</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1.5">{positions.length}</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-2 rounded flex items-center justify-center gap-1">
                {(['All', 'Equity', 'Option'] as FilterType[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn(
                      "flex-1 h-full px-3 py-2 text-xs font-bold transition-all rounded",
                      filter === f ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-zinc-400 hover:text-zinc-300"
                    )}>
                    {f}
                  </button>
                ))}
            </div>
          </div>

          {/* PnL Chart */}
          <PositionsChart positions={filtered} />

          {/* Positions Table */}          <div className="border border-white/10 rounded overflow-hidden bg-zinc-900/20 backdrop-blur-sm">
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
                        <span className="px-2 py-1 rounded bg-current/5">
                          {pos.dayPnLPct >= 0 ? '▲' : '▼'} {Math.abs(pos.dayPnLPct).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-xs text-zinc-400 font-medium truncate max-w-[200px]">
                        {pos.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
