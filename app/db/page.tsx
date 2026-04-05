'use client';

import { useEffect, useState, useCallback } from 'react';
import { Database, Table, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableInfo { name: string; count: number; }
interface Column { name: string; type: string; pk: number; }

export default function DbBrowserPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/db').then(r => r.json()).then(data => {
      setTables(data.tables || []);
    });
  }, []);

  const fetchTable = useCallback(async (table: string, p: number, s: string, sort: string, dir: string) => {
    setLoading(true);
    const params = new URLSearchParams({ table, page: String(p), limit: '50' });
    if (s) params.set('search', s);
    if (sort) { params.set('sort', sort); params.set('dir', dir); }
    const res = await fetch(`/api/db?${params}`);
    const data = await res.json();
    setColumns(data.columns || []);
    setRows(data.rows || []);
    setTotal(data.total || 0);
    setTotalPages(data.totalPages || 1);
    setLoading(false);
  }, []);

  const selectTable = (name: string) => {
    setActiveTable(name);
    setPage(1);
    setSearch('');
    setSearchInput('');
    setSortBy('');
    setSortDir('desc');
    fetchTable(name, 1, '', '', 'desc');
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
    if (activeTable) fetchTable(activeTable, 1, searchInput, sortBy, sortDir);
  };

  const handleSort = (col: string) => {
    const newDir = sortBy === col && sortDir === 'desc' ? 'asc' : 'desc';
    setSortBy(col);
    setSortDir(newDir);
    if (activeTable) fetchTable(activeTable, page, search, col, newDir);
  };

  const handlePage = (p: number) => {
    setPage(p);
    if (activeTable) fetchTable(activeTable, p, search, sortBy, sortDir);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      if (Number.isInteger(value) && value > 1_000_000_000 && value < 2_000_000_000) {
        return new Date(value * 1000).toLocaleString();
      }
      if (!Number.isInteger(value)) return value.toFixed(4);
    }
    const s = String(value);
    return s.length > 120 ? s.slice(0, 120) + '…' : s;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          Database Browser
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Browse all tables and data in the SQLite database.</p>
      </div>

      {/* Table Selector */}
      <div className="flex flex-wrap gap-2">
        {tables.map(t => (
          <button
            key={t.name}
            onClick={() => selectTable(t.name)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all",
              activeTable === t.name
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-zinc-200"
            )}
          >
            <Table className="h-3.5 w-3.5" />
            <span>{t.name}</span>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              activeTable === t.name ? "bg-white/20 text-white" : "bg-white/5 text-zinc-500"
            )}>
              {t.count.toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* Table Content */}
      {activeTable && (
        <div className="flex flex-col gap-4">
          {/* Search & Info Bar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-zinc-950/50 px-3 py-2 border border-white/5 flex-1 max-w-md">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search text columns..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600 flex-1"
              />
            </div>
            <button
              onClick={handleSearch}
              className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
            >
              Search
            </button>
            <div className="ml-auto text-sm text-zinc-500">
              <span className="font-bold text-zinc-300">{total.toLocaleString()}</span> rows
              {search && <span> matching &ldquo;<span className="text-primary">{search}</span>&rdquo;</span>}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-zinc-950/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  {columns.map(col => (
                    <th
                      key={col.name}
                      onClick={() => handleSort(col.name)}
                      className="cursor-pointer px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors select-none whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.name}</span>
                        {sortBy === col.name ? (
                          sortDir === 'desc'
                            ? <ArrowDown className="h-3 w-3 text-primary" />
                            : <ArrowUp className="h-3 w-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-zinc-700" />
                        )}
                        {col.pk > 0 && <span className="text-amber-500 text-[9px]">PK</span>}
                      </div>
                      <div className="text-[9px] font-normal text-zinc-700 tracking-normal normal-case">{col.type}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center text-zinc-500">
                      No data found
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                    >
                      {columns.map(col => (
                        <td
                          key={col.name}
                          className="px-4 py-2.5 text-zinc-300 whitespace-nowrap max-w-[300px] truncate font-mono text-xs"
                          title={String(row[col.name] ?? '')}
                        >
                          {formatValue(row[col.name])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-500">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePage(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-zinc-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => handlePage(p)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
                        p === page
                          ? "bg-primary text-white"
                          : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePage(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-zinc-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!activeTable && (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/10 bg-white/5 text-zinc-500">
          <Database className="h-12 w-12 opacity-20" />
          <p className="text-sm">Select a table above to browse its contents.</p>
        </div>
      )}
    </div>
  );
}
