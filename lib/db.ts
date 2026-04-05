import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'optionsflow.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initializeSchema(_db);
  }
  return _db;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      broker TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      access_token_expires_at INTEGER NOT NULL,
      refresh_token_expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      strategy TEXT NOT NULL DEFAULT 'CSP',
      added_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      strategy TEXT NOT NULL,
      strike REAL NOT NULL,
      expiry TEXT NOT NULL,
      dte INTEGER NOT NULL,
      premium REAL NOT NULL,
      max_loss REAL NOT NULL,
      pop REAL NOT NULL,
      iv_rank REAL NOT NULL,
      delta REAL NOT NULL,
      theta REAL NOT NULL,
      vega REAL NOT NULL,
      bid REAL NOT NULL,
      ask REAL NOT NULL,
      underlying_price REAL NOT NULL,
      ai_score REAL NOT NULL,
      ai_flag TEXT NOT NULL,
      ai_brief TEXT NOT NULL,
      ai_risks TEXT,
      screened_at INTEGER NOT NULL,
      is_eligible INTEGER NOT NULL DEFAULT 1,
      rejection_reason TEXT,
      spread_long_strike REAL,
      collar_put_strike REAL
    );

    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      queued_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broker TEXT NOT NULL DEFAULT 'schwab',
      symbol TEXT NOT NULL,
      strategy TEXT NOT NULL,
      broker_order_id TEXT,
      strike REAL NOT NULL,
      expiry TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      fill_price REAL,
      premium_collected REAL,
      max_loss REAL,
      status TEXT NOT NULL,
      executed_at INTEGER NOT NULL,
      closed_at INTEGER,
      close_price REAL,
      realized_pnl REAL
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const candidateColumns = db.prepare("PRAGMA table_info(candidates)").all() as Array<{ name: string }>;
  const candidateColumnNames = new Set(candidateColumns.map((column) => column.name));
  if (!candidateColumnNames.has('is_eligible')) {
    db.exec('ALTER TABLE candidates ADD COLUMN is_eligible INTEGER NOT NULL DEFAULT 1');
  }
  if (!candidateColumnNames.has('rejection_reason')) {
    db.exec('ALTER TABLE candidates ADD COLUMN rejection_reason TEXT');
  }

  const defaultConfig: Record<string, unknown> = {
    dte_min: 21,
    dte_max: 45,
    delta_min: 0.15,
    delta_max: 0.30,
    iv_rank_min: 50,
    min_premium: 0.50,
    max_bid_ask_spread_pct: 0.10,
    max_position_pct: 0.05,
    max_deployed_pct: 0.50,
    min_open_interest: 500,
    exclude_earnings_in_dte: true,
    vix_defensive_threshold: 30,
    watchlist_default: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "JPM", "WMT"],
  };

  const insertConfig = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultConfig)) {
    insertConfig.run(key, JSON.stringify(value));
  }

  const defaultSymbols = defaultConfig.watchlist_default as string[];
  const insertWatchlist = db.prepare('INSERT OR IGNORE INTO watchlist (symbol, strategy, added_at) VALUES (?, ?, ?)');
  const now = Math.floor(Date.now() / 1000);
  for (const symbol of defaultSymbols) {
    insertWatchlist.run(symbol, 'CSP', now);
  }
}

// --- Typed Interfaces ---

export interface Candidate {
  id: number;
  symbol: string;
  strategy: string;
  strike: number;
  expiry: string;
  dte: number;
  premium: number;
  max_loss: number;
  pop: number;
  iv_rank: number;
  delta: number;
  theta: number;
  vega: number;
  bid: number;
  ask: number;
  underlying_price: number;
  ai_score: number;
  ai_flag: string;
  ai_brief: string;
  ai_risks: string | null;
  screened_at: number;
  is_eligible: number;
  rejection_reason: string | null;
  spread_long_strike: number | null;
  collar_put_strike: number | null;
}

export interface QueueItem {
  id: number;
  candidate_id: number;
  quantity: number;
  notes: string | null;
  queued_at: number;
  status: string;
}

export interface QueueItemWithCandidate extends QueueItem, Candidate {
  queue_id: number;
}

export interface TradeHistoryItem {
  id: number;
  broker: string;
  symbol: string;
  strategy: string;
  broker_order_id: string | null;
  strike: number;
  expiry: string;
  quantity: number;
  fill_price: number | null;
  premium_collected: number | null;
  max_loss: number | null;
  status: string;
  executed_at: number;
  closed_at: number | null;
  close_price: number | null;
  realized_pnl: number | null;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  created_at: number;
}

// --- Query Helpers ---

export function getConfig(key: string): unknown {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : undefined;
}

export function setConfig(key: string, value: unknown): void {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

export function getCandidates(filters?: { flag?: string; strategy?: string; min_pop?: number }): Candidate[] {
  const db = getDb();
  const fortyEightHoursAgo = Math.floor(Date.now() / 1000) - 48 * 60 * 60;
  let query = 'SELECT * FROM candidates WHERE screened_at > ?';
  const params: unknown[] = [fortyEightHoursAgo];

  if (filters?.flag) { query += ' AND ai_flag = ?'; params.push(filters.flag); }
  if (filters?.strategy) { query += ' AND strategy = ?'; params.push(filters.strategy); }
  if (filters?.min_pop !== undefined) { query += ' AND pop >= ?'; params.push(filters.min_pop); }

  query += ' ORDER BY ai_score DESC';
  return db.prepare(query).all(...params) as Candidate[];
}

export function getQueueItems(): QueueItemWithCandidate[] {
  const db = getDb();
  return db.prepare(`
    SELECT q.id as queue_id, q.candidate_id, q.quantity, q.notes, q.queued_at, q.status, c.*
    FROM queue q JOIN candidates c ON q.candidate_id = c.id
    WHERE q.status = 'PENDING' ORDER BY q.queued_at DESC
  `).all() as QueueItemWithCandidate[];
}

export function addToQueue(candidateId: number, quantity: number, notes?: string): QueueItem {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare(
    'INSERT INTO queue (candidate_id, quantity, notes, queued_at, status) VALUES (?, ?, ?, ?, ?)'
  ).run(candidateId, quantity, notes || null, now, 'PENDING');
  return { id: result.lastInsertRowid as number, candidate_id: candidateId, quantity, notes: notes || null, queued_at: now, status: 'PENDING' };
}

export function removeFromQueue(id: number): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM queue WHERE id = ? AND status = ?').run(id, 'PENDING').changes > 0;
}

export function updateQueueStatus(id: number, status: string): void {
  const db = getDb();
  db.prepare('UPDATE queue SET status = ? WHERE id = ?').run(status, id);
}

export function insertCandidate(candidate: Omit<Candidate, 'id'>): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO candidates (symbol, strategy, strike, expiry, dte, premium, max_loss, pop,
      iv_rank, delta, theta, vega, bid, ask, underlying_price, ai_score, ai_flag, ai_brief,
      ai_risks, screened_at, is_eligible, rejection_reason, spread_long_strike, collar_put_strike)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    candidate.symbol, candidate.strategy, candidate.strike, candidate.expiry,
    candidate.dte, candidate.premium, candidate.max_loss, candidate.pop,
    candidate.iv_rank, candidate.delta, candidate.theta, candidate.vega,
    candidate.bid, candidate.ask, candidate.underlying_price, candidate.ai_score,
    candidate.ai_flag, candidate.ai_brief, candidate.ai_risks,
    candidate.screened_at, candidate.is_eligible, candidate.rejection_reason,
    candidate.spread_long_strike, candidate.collar_put_strike
  );
  return result.lastInsertRowid as number;
}

export function cleanOldCandidates(): void {
  const db = getDb();
  const fortyEightHoursAgo = Math.floor(Date.now() / 1000) - 48 * 60 * 60;
  db.prepare('DELETE FROM candidates WHERE screened_at < ?').run(fortyEightHoursAgo);
}

export function addTradeHistory(trade: Omit<TradeHistoryItem, 'id'>): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO trade_history (broker, symbol, strategy, broker_order_id, strike, expiry, quantity,
      fill_price, premium_collected, max_loss, status, executed_at, closed_at, close_price, realized_pnl)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    trade.broker, trade.symbol, trade.strategy, trade.broker_order_id, trade.strike, trade.expiry,
    trade.quantity, trade.fill_price, trade.premium_collected, trade.max_loss,
    trade.status, trade.executed_at, trade.closed_at, trade.close_price, trade.realized_pnl
  );
  return result.lastInsertRowid as number;
}

export function getChatHistory(limit = 10): ChatMessage[] {
  const db = getDb();
  return db.prepare('SELECT * FROM chat_history ORDER BY created_at DESC LIMIT ?').all(limit) as ChatMessage[];
}

export function addChatMessage(role: string, content: string): number {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare('INSERT INTO chat_history (role, content, created_at) VALUES (?, ?, ?)').run(role, content, now);
  return result.lastInsertRowid as number;
}

export function clearChatHistory(): void {
  const db = getDb();
  db.prepare('DELETE FROM chat_history').run();
}

export function getWatchlist(): { id: number; symbol: string; enabled: number; strategy: string; added_at: number }[] {
  const db = getDb();
  return db.prepare('SELECT * FROM watchlist WHERE enabled = 1').all() as { id: number; symbol: string; enabled: number; strategy: string; added_at: number }[];
}
