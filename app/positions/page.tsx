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

type FilterType = 'ALL' | 'EQUITY' | 'OPTION';

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const { active } = useBrokerStore();

  const brokerLabel = active.toUpperCase();

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'schwab-connected') {
        setNeedsAuth(false);
        setError(null);
        fetchPositions();
      }
      if (event.data?.type === 'schwab-auth-error') {
        setError(event.data?.message || 'AUTHORIZATION_FAILED');
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
        setError(data.error || 'CONNECTION_FAILED');
      }
    } catch {
      setError('FAILED_TO_CONNECT');
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
        setError(data.message || 'FETCH_FAILED');
        setPositions([]);
        return;
      }
      setPositions(data.positions || []);
    } catch (err) {
      setError('SERVER_ERROR');
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
          "px-1.5 py-0.5 text-[10px] font-bold border",
          pos.putCall === 'PUT' ? "border-blue-900 bg-blue-950/20 text-blue-400" : "border-emerald-900 bg-emerald-950/20 terminal-green"
        )}>
          {pos.putCall}
        </span>
      );
    }
    if (pos.assetType === 'OPTION') {
      return <span className="border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">OPTION</span>;
    }
    return <span className="border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">EQUITY</span>;
  };

  const filtered = positions.filter(p => {
    if (filter === 'ALL') return true;
    if (filter === 'EQUITY') return p.assetType !== 'OPTION';
    return p.assetType === 'OPTION';
  });

  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalDayPnL = positions.reduce((s, p) => s + p.dayPnL, 0);

  return (
    <div className="flex flex-col gap-4 font-mono">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div>
          <h1 className="text-xl font-black text-white tracking-tighter uppercase">Portfolio Positions</h1>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Live_Feed // Broker: {brokerLabel}</p>
        </div>
        <button 
          onClick={fetchPositions} 
          className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-black text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <RefreshCw className="h-3 w-3" />
          REFRESH
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center border border-dashed border-zinc-800">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
        </div>
      ) : needsAuth ? (
        <div className="flex h-48 flex-col items-center justify-center gap-4 border border-zinc-800 bg-zinc-950 p-6 text-center">
          <Key className="h-8 w-8 text-zinc-700" />
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Authentication Required</p>
            <p className="text-[10px] text-zinc-600 mt-1 uppercase">Link your {brokerLabel} account to view live data</p>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="border border-primary bg-primary/10 px-6 py-2 text-xs font-black text-primary transition-all hover:bg-primary hover:text-white disabled:opacity-50"
          >
            {connecting ? 'CONNECTING...' : `CONNECT_${brokerLabel}`}
          </button>
        </div>
      ) : error ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 border border-terminal-red/30 bg-terminal-red/5 p-4 text-center">
          <AlertTriangle className="h-6 w-6 terminal-red" />
          <p className="text-xs font-bold terminal-red uppercase">{error}</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 border border-dashed border-zinc-800 text-zinc-700">
          <BarChart3 className="h-6 w-6 opacity-20" />
          <span className="text-[10px] font-black uppercase">No_Active_Positions</span>
        </div>
      ) : (
        <>
          {/* High-Density Summary Row */}
          <div className="grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
            <div className="bg-black p-3">
              <div className="text-[9px] font-black text-zinc-600 uppercase">Market Value</div>
              <div className="text-lg font-black text-white">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-black p-3">
              <div className="text-[9px] font-black text-zinc-600 uppercase">Day P&L</div>
              <div className={cn("text-lg font-black", getPnLColor(totalDayPnL))}>
                {totalDayPnL >= 0 ? '+' : ''}${totalDayPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-black p-3">
              <div className="text-[9px] font-black text-zinc-600 uppercase">Positions</div>
              <div className="text-lg font-black text-zinc-300">{positions.length} <span className="text-[10px] text-zinc-600 uppercase ml-1">Items</span></div>
            </div>
            <div className="bg-black p-3 flex flex-col justify-center">
              <div className="flex gap-1">
                {(['ALL', 'EQUITY', 'OPTION'] as FilterType[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn(
                      "px-2 py-0.5 text-[9px] font-black transition-colors border uppercase",
                      filter === f ? "border-primary bg-primary text-black" : "border-zinc-800 text-zinc-600 hover:text-zinc-300"
                    )}>
                    {f === 'ALL' ? 'ALL' : f === 'EQUITY' ? 'EQU' : 'OPT'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Positions Table - Dense Bloomberg Terminal Style */}
          <div className="border border-zinc-800">
            <table className="w-full text-[11px] leading-tight">
              <thead>
                <tr className="bg-zinc-900/50 text-left text-[9px] font-black text-zinc-500 border-b border-zinc-800 uppercase tracking-widest">
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Avg_Px</th>
                  <th className="px-3 py-2 text-right">Mkt_Val</th>
                  <th className="px-3 py-2 text-right">Day_P&L</th>
                  <th className="px-3 py-2 text-right">Day_Chg%</th>
                  <th className="px-3 py-2 hidden lg:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filtered.map((pos, i) => (
                  <tr key={i} className="bg-black transition-colors hover:bg-zinc-900/50">
                    <td className="px-3 py-1.5 font-bold text-white">{pos.symbol}</td>
                    <td className="px-3 py-1.5">{getTypeBadge(pos)}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-zinc-300">{pos.quantity}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-400">${pos.averagePrice.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-white">${pos.marketValue.toFixed(2)}</td>
                    <td className={cn("px-3 py-1.5 text-right font-black", getPnLColor(pos.dayPnL))}>
                      {pos.dayPnL >= 0 ? '+' : ''}${pos.dayPnL.toFixed(2)}
                    </td>
                    <td className={cn("px-3 py-1.5 text-right font-black", getPnLColor(pos.dayPnLPct))}>
                      {pos.dayPnLPct >= 0 ? '+' : ''}{pos.dayPnLPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-1.5 hidden lg:table-cell text-[9px] text-zinc-600 truncate max-w-[200px] uppercase font-bold italic">
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
