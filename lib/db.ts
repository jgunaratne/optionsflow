import Database from 'better-sqlite3';
import path from 'path';
import type { RedditPost } from './reddit';

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

    CREATE TABLE IF NOT EXISTS broker_snapshots (
      broker TEXT NOT NULL,
      key TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (broker, key)
    );

    CREATE TABLE IF NOT EXISTS reddit_posts (
      id TEXT PRIMARY KEY,
      subreddit TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      score INTEGER DEFAULT 0,
      num_comments INTEGER DEFAULT 0,
      selftext TEXT,
      url TEXT,
      permalink TEXT,
      created_utc INTEGER,
      thumbnail TEXT,
      is_self INTEGER DEFAULT 0,
      domain TEXT,
      link_flair_text TEXT,
      fetched_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reddit_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subreddits TEXT NOT NULL,
      analysis TEXT NOT NULL,
      post_count INTEGER,
      analyzed_at TEXT DEFAULT (datetime('now'))
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
    screener_universe: 'watchlist',
    sp500_batch_size: 50,
    sp500_cursor: 0,
    iv_rank_min: 50,
    min_premium: 0.50,
    max_bid_ask_spread_pct: 0.10,
    max_position_pct: 0.05,
    max_deployed_pct: 0.50,
    min_open_interest: 500,
    exclude_earnings_in_dte: true,
    vix_defensive_threshold: 30,
    watchlist_default: [
      "SPY", "QQQ", "IWM", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", 
      "TSLA", "BRK.B", "UNH", "JNJ", "XOM", "V", "PG", "MA", "AVGO", "HD", 
      "CVX", "MRK", "ABBV", "PEP", "COST", "KO", "ADBE", "WMT", "MCD", "CSCO", 
      "PFE", "BAC", "CRM", "TMO", "LIN", "ABT", "ORCL", "AMD", "DIS", "ACN", 
      "TXN", "PM", "MS", "VZ", "NEE", "RTX", "NKE", "HON", "AMGN", "LOW", 
      "SPGI", "IBM", "UNP", "CAT", "INTC", "GE", "COP", "GS", "ISRG", "DE", 
      "QCOM", "BKNG", "AMAT", "MDT", "SBUX", "TJX", "BLK", "AMT", "SYK", "NOW", 
      "ADP", "GILD", "MMC", "ADI", "C", "CVS", "MDLZ", "LLY", "MO", "LMT", 
      "CB", "CI", "T", "ELV", "SCHW", "REGN", "ZTS", "PLD", "DUK", "SO", 
      "PGR", "VRTX", "BSX", "MU", "ETN", "FISV", "ITW", "HUM", "MPC", "PYPL"
    ],
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

export interface BrokerSnapshot<T> {
  broker: string;
  key: string;
  payload: T;
  updated_at: number;
}

interface RedditPostRow {
  id: string;
  title: string;
  author: string | null;
  score: number;
  num_comments: number;
  selftext: string | null;
  url: string | null;
  permalink: string | null;
  created_utc: number;
  thumbnail: string | null;
  is_self: number;
  domain: string | null;
  link_flair_text: string | null;
  subreddit: string;
}

interface CachedRedditAnalysisRecord {
  tickers?: unknown;
  summary?: unknown;
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

export function getBrokerSnapshot<T>(broker: string, key: string): BrokerSnapshot<T> | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT broker, key, payload, updated_at FROM broker_snapshots WHERE broker = ? AND key = ?'
  ).get(broker, key) as { broker: string; key: string; payload: string; updated_at: number } | undefined;

  if (!row) return null;

  return {
    broker: row.broker,
    key: row.key,
    payload: JSON.parse(row.payload) as T,
    updated_at: row.updated_at,
  };
}

export function setBrokerSnapshot(broker: string, key: string, payload: unknown): number {
  const db = getDb();
  const updatedAt = Math.floor(Date.now() / 1000);
  db.prepare(
    'INSERT OR REPLACE INTO broker_snapshots (broker, key, payload, updated_at) VALUES (?, ?, ?, ?)'
  ).run(broker, key, JSON.stringify(payload), updatedAt);
  return updatedAt;
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

// --- Reddit Cache Helpers ---

export function cacheRedditPosts(posts: RedditPost[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO reddit_posts
      (id, subreddit, title, author, score, num_comments, selftext, url, permalink, created_utc, thumbnail, is_self, domain, link_flair_text, fetched_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertMany = db.transaction((items: RedditPost[]) => {
    for (const p of items) {
      stmt.run(
        p.id, p.subreddit, p.title, p.author, p.score, p.numComments,
        p.selftext, p.url, p.permalink, p.createdUtc, p.thumbnail,
        p.isSelf ? 1 : 0, p.domain, p.linkFlairText,
      );
    }
  });

  insertMany(posts);
}

export function getCachedRedditPosts(subreddits: string[], maxAgeMinutes = 15): RedditPost[] {
  const db = getDb();
  const placeholders = subreddits.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT * FROM reddit_posts
    WHERE subreddit IN (${placeholders})
      AND fetched_at > datetime('now', '-${maxAgeMinutes} minutes')
    ORDER BY score DESC
  `).all(...subreddits) as RedditPostRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author ?? '[deleted]',
    score: row.score,
    numComments: row.num_comments,
    selftext: row.selftext || '',
    url: row.url ?? '',
    permalink: row.permalink ?? '',
    createdUtc: row.created_utc,
    thumbnail: row.thumbnail,
    isSelf: row.is_self === 1,
    domain: row.domain ?? '',
    linkFlairText: row.link_flair_text,
    subreddit: row.subreddit,
  }));
}

export function cacheRedditAnalysis(subreddits: string[], analysis: string, postCount: number): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO reddit_analysis (subreddits, analysis, post_count, analyzed_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(JSON.stringify(subreddits.sort()), analysis, postCount);
}

export function getCachedRedditAnalysis(subreddits: string[], maxAgeMinutes = 30): {
  tickers: unknown[];
  summary: string;
  postCount: number;
  analyzedAt: string;
  subreddits: string[];
} | null {
  const db = getDb();
  const sortedKey = JSON.stringify(subreddits.sort());
  const row = db.prepare(`
    SELECT analysis, post_count, analyzed_at FROM reddit_analysis
    WHERE subreddits = ?
      AND analyzed_at > datetime('now', '-${maxAgeMinutes} minutes')
    ORDER BY analyzed_at DESC
    LIMIT 1
  `).get(sortedKey) as { analysis: string; post_count: number; analyzed_at: string } | undefined;

  if (!row) return null;

  try {
    const parsed = JSON.parse(row.analysis) as CachedRedditAnalysisRecord;
    return {
      tickers: Array.isArray(parsed.tickers) ? parsed.tickers : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis complete.',
      postCount: row.post_count,
      analyzedAt: row.analyzed_at,
      subreddits,
    };
  } catch {
    return null;
  }
}
