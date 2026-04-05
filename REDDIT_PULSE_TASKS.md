# Reddit Pulse — Multi-Agent Task Checklist

> **Instructions for coding agents:**
> 1. `git pull` before starting any task
> 2. Find the first unchecked `[ ]` item — claim it by marking `[x]` and committing this file immediately
> 3. Implement the task fully
> 4. `git add . && git commit -m "reddit-pulse: <task summary>" && git push`
> 5. Move to the next unchecked item. If none remain, you're done.
>
> **Conflict avoidance:** Tasks in the same Phase can run in parallel (they touch different files). Tasks across phases have dependencies — do NOT start a later phase until all earlier phases are complete.

---

## Context

We are adding a **"Reddit Pulse"** tab to OptionsFlow that monitors stock/options subreddits, extracts ticker mentions using Gemini AI, and displays sentiment analysis.

**Target subreddits:** `r/options`, `r/thetagang`, `r/wallstreetbets`, `r/stocks`, `r/options_trading`

**Auth approach:** App-only OAuth (client credentials grant) — no Reddit user login needed. Uses `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` env vars.

**Reference codebase:** `../juni-reddit/src/lib/reddit.js` has working Reddit API patterns to adapt.

**Existing stack:** Next.js 14 + TypeScript + Tailwind + SQLite (better-sqlite3) + Zustand + Gemini (`@google/generative-ai`) + lucide-react + framer-motion + recharts

---

## Phase 1 — Foundation (parallel-safe, all new files)

- [ ] **1.1 — Reddit API Client (`lib/reddit.ts`)**

  Create `/Users/junius/git/optionsflow/lib/reddit.ts`:

  - Export type `RedditPost { id, title, author, score, numComments, selftext, url, permalink, createdUtc, thumbnail, isSelf, domain, linkFlairText, subreddit }`
  - Export `DEFAULT_STOCK_SUBREDDITS = ['options', 'thetagang', 'wallstreetbets', 'stocks', 'options_trading']`
  - `getAppOnlyToken()` — POST to `https://www.reddit.com/api/v1/access_token` with `grant_type=client_credentials`, Basic auth with `REDDIT_CLIENT_ID:REDDIT_CLIENT_SECRET`. Cache token in module-level variable with expiry check (~1hr TTL). Return access token string.
  - `fetchReddit(endpoint: string, token: string)` — GET `https://oauth.reddit.com${endpoint}` with `Authorization: Bearer ${token}` and `User-Agent: optionsflow/1.0`. Return parsed JSON.
  - `getHotPosts(subreddit: string, token: string, limit = 50): Promise<RedditPost[]>` — Fetch `/r/${subreddit}/hot?limit=${limit}`, map Reddit API response to `RedditPost[]`.

  Reference `../juni-reddit/src/lib/reddit.js` for the Reddit API response shape and field mapping.

  **Commit:** `reddit-pulse: add Reddit API client lib`

---

- [ ] **1.2 — Database Schema (`lib/db.ts`)**

  Modify `/Users/junius/git/optionsflow/lib/db.ts`:

  Add these tables to the schema initialization section (find the block of `db.exec(CREATE TABLE IF NOT EXISTS ...)` statements and add after them):

  ```sql
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
  ```

  Add helper functions at the bottom of the file:

  ```typescript
  export function cacheRedditPosts(posts: RedditPost[]): void
  // INSERT OR REPLACE into reddit_posts

  export function getCachedRedditPosts(subreddits: string[], maxAgeMinutes = 15): RedditPost[]
  // SELECT from reddit_posts WHERE subreddit IN (...) AND fetched_at > datetime('now', '-N minutes')

  export function cacheRedditAnalysis(subreddits: string[], analysis: string, postCount: number): void
  // INSERT into reddit_analysis

  export function getCachedRedditAnalysis(subreddits: string[], maxAgeMinutes = 30): any | null
  // SELECT most recent from reddit_analysis WHERE subreddits = JSON match AND analyzed_at > threshold
  // Return parsed JSON or null
  ```

  Import the `RedditPost` type from `./reddit` (or define a compatible interface locally to avoid circular deps).

  **Commit:** `reddit-pulse: add reddit DB tables and helpers`

---

- [ ] **1.3 — Environment Config (`.env.example`)**

  Modify `/Users/junius/git/optionsflow/.env.example` — append:

  ```
  # Reddit API (app-only OAuth — no user login required)
  # Register at: https://www.reddit.com/prefs/apps (type: script)
  REDDIT_CLIENT_ID=your-reddit-client-id
  REDDIT_CLIENT_SECRET=your-reddit-client-secret
  ```

  **Commit:** `reddit-pulse: add Reddit env vars to .env.example`

---

## Phase 2 — API Routes (depends on Phase 1)

- [ ] **2.1 — Posts API Route (`app/api/reddit/posts/route.ts`)**

  Create `/Users/junius/git/optionsflow/app/api/reddit/posts/route.ts`:

  `GET /api/reddit/posts?subreddits=options,thetagang` (defaults to all if omitted)

  1. Parse `subreddits` query param (comma-separated) or use `DEFAULT_STOCK_SUBREDDITS`
  2. Check cache: call `getCachedRedditPosts(subreddits, 15)` — if results exist, return them
  3. Otherwise: call `getAppOnlyToken()`, then `getHotPosts()` for each subreddit in parallel (`Promise.all`)
  4. Flatten results, call `cacheRedditPosts(allPosts)`
  5. Return `NextResponse.json({ posts, cachedAt: new Date().toISOString() })`
  6. Wrap in try/catch, return 500 on error

  **Commit:** `reddit-pulse: add /api/reddit/posts route`

---

- [ ] **2.2 — Analysis API Route (`app/api/reddit/analyze/route.ts`)**

  Create `/Users/junius/git/optionsflow/app/api/reddit/analyze/route.ts`:

  `POST /api/reddit/analyze` with body `{ subreddits?: string[] }`

  1. Parse subreddits from body or use defaults
  2. Check cache: `getCachedRedditAnalysis(subreddits, 30)` — return if fresh
  3. Fetch posts: GET own `/api/reddit/posts` endpoint internally, or call the lib functions directly
  4. Build Gemini prompt with all post titles, scores, selftexts (truncated to 200 chars each)
  5. Prompt should instruct Gemini to return **valid JSON** with this shape:
     ```
     {
       "tickers": [{ "symbol": "AAPL", "mentions": 5, "sentiment": "bullish", "avgScore": 342, "tradeIdeas": ["AAPL 200C 5/16"], "strategies": ["covered call"], "topPosts": [{ "title": "...", "permalink": "...", "score": 500 }] }],
       "summary": "Reddit is most excited about..."
     }
     ```
  6. Use `@google/generative-ai` (already installed) — same pattern as `lib/ai.ts`
  7. Parse Gemini response, cache with `cacheRedditAnalysis()`
  8. Return the full analysis object with metadata (`analyzedAt`, `postCount`, `subreddits`)

  **Commit:** `reddit-pulse: add /api/reddit/analyze route`

---

## Phase 3 — State Management (depends on Phase 2)

- [ ] **3.1 — Zustand Store (`lib/store.ts`)**

  Modify `/Users/junius/git/optionsflow/lib/store.ts` — add a new store at the bottom:

  ```typescript
  // Import RedditPost type from './reddit'
  // Define RedditAnalysis type inline or import

  interface RedditTickerAnalysis {
    symbol: string;
    mentions: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    avgScore: number;
    tradeIdeas: string[];
    strategies: string[];
    topPosts: { title: string; permalink: string; score: number }[];
  }

  interface RedditAnalysis {
    tickers: RedditTickerAnalysis[];
    summary: string;
    analyzedAt: string;
    postCount: number;
    subreddits: string[];
  }

  interface RedditState {
    posts: RedditPost[];
    analysis: RedditAnalysis | null;
    activeSubreddits: string[];
    loading: boolean;
    analyzing: boolean;
    error: string | null;
    lastRefreshed: string | null;
    setActiveSubreddits: (subs: string[]) => void;
    fetchPosts: () => Promise<void>;
    runAnalysis: () => Promise<void>;
  }

  export const useRedditStore = create<RedditState>((set, get) => ({
    posts: [],
    analysis: null,
    activeSubreddits: ['options', 'thetagang', 'wallstreetbets', 'stocks', 'options_trading'],
    loading: false,
    analyzing: false,
    error: null,
    lastRefreshed: null,
    setActiveSubreddits: (subs) => set({ activeSubreddits: subs }),
    fetchPosts: async () => {
      set({ loading: true, error: null });
      try {
        const { activeSubreddits } = get();
        const res = await fetch(`/api/reddit/posts?subreddits=${activeSubreddits.join(',')}`);
        const data = await res.json();
        set({ posts: data.posts, lastRefreshed: data.cachedAt, loading: false });
      } catch (e: any) {
        set({ error: e.message, loading: false });
      }
    },
    runAnalysis: async () => {
      set({ analyzing: true, error: null });
      try {
        const { activeSubreddits } = get();
        const res = await fetch('/api/reddit/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subreddits: activeSubreddits }),
        });
        const data = await res.json();
        set({ analysis: data, analyzing: false });
      } catch (e: any) {
        set({ error: e.message, analyzing: false });
      }
    },
  }));
  ```

  **Commit:** `reddit-pulse: add useRedditStore to Zustand`

---

## Phase 4 — UI Components (depends on Phase 3)

- [ ] **4.1 — RedditTickerCard Component (`components/RedditTickerCard.tsx`)**

  Create `/Users/junius/git/optionsflow/components/RedditTickerCard.tsx`:

  Props: `{ ticker: RedditTickerAnalysis, isInWatchlist: boolean, onExpand?: () => void }`

  Design (match optionsflow dark glassmorphism):
  - Card: `bg-zinc-900/20 border border-white/10 rounded-2xl p-4 backdrop-blur-md`
  - Left border colored by sentiment: emerald-500 (bullish), red-500 (bearish), zinc-500 (neutral)
  - **Top row:** Large ticker symbol (`text-xl font-bold text-white font-mono`) + sentiment pill badge
  - **Stats row:** Mention count, avg post score — use `text-[10px] uppercase tracking-wider text-zinc-400` labels
  - **Trade ideas:** If present, show as `text-sm text-zinc-300` list items
  - **Strategy pills:** Small rounded pills (`bg-white/10 text-zinc-300 text-xs px-2 py-0.5 rounded-full`)
  - **Watchlist badge:** If `isInWatchlist`, show "In Watchlist" with a green dot
  - Expandable section (use `framer-motion` AnimatePresence) showing `topPosts` with score + title + link
  - Hover: `hover:bg-white/5 transition-colors cursor-pointer`

  **Commit:** `reddit-pulse: add RedditTickerCard component`

---

- [ ] **4.2 — RedditPostItem Component (`components/RedditPostItem.tsx`)**

  Create `/Users/junius/git/optionsflow/components/RedditPostItem.tsx`:

  Props: `{ post: RedditPost }`

  Design:
  - Row layout: `flex items-start gap-3 p-3 border-b border-white/5 hover:bg-white/5 transition-colors`
  - **Subreddit badge:** Colored pill per subreddit (e.g., `r/wsb` = amber, `r/thetagang` = emerald, `r/options` = blue, `r/stocks` = purple)
  - **Title:** `text-sm text-zinc-200` — auto-highlight ticker symbols (regex `\$?[A-Z]{1,5}\b`) with `text-cyan-400 font-mono font-semibold`
  - **Meta row:** author (`text-zinc-500`), score with arrow icon, comment count, relative time (e.g., "2h ago")
  - **"Open in Reddit"** link icon on hover (lucide `ExternalLink`)

  Helper: `formatRelativeTime(utcSeconds: number): string` — converts Unix timestamp to "2h ago", "1d ago", etc.

  **Commit:** `reddit-pulse: add RedditPostItem component`

---

## Phase 5 — Main Page (depends on Phase 4)

- [ ] **5.1 — Reddit Page (`app/reddit/page.tsx`)**

  Create `/Users/junius/git/optionsflow/app/reddit/page.tsx`:

  `'use client'` component, default export `RedditPulsePage`.

  Import `useRedditStore` from `@/lib/store`, icons from `lucide-react` (`Radio`, `RefreshCw`, `TrendingUp`, `Loader2`), `cn` from `@/lib/utils`, `RedditTickerCard`, `RedditPostItem`.

  **Layout:**
  ```
  ┌─────────────────────────────────────────────────┐
  │ Header: "Reddit Pulse" + subreddit pills + Refresh │
  ├─────────────────────────────────────────────────┤
  │ AI Summary Card (full width)                     │
  ├───────────────────────┬─────────────────────────┤
  │ Ticker Grid (2/3)     │ Recent Posts Feed (1/3)  │
  │ - sorted by mentions  │ - scrollable list        │
  │ - expandable cards    │ - all subreddits mixed   │
  └───────────────────────┴─────────────────────────┘
  ```

  **Header section** (`border-b border-white/10 pb-6 mt-2`):
  - `<h1 className="text-3xl font-bold tracking-tight text-white">` with Radio icon
  - Subreddit toggle pills: each pill shows `r/name`, click toggles it in `activeSubreddits`. Active = `bg-white/15 text-white`, inactive = `bg-white/5 text-zinc-500`
  - Refresh button: `bg-gradient-to-r from-zinc-600 to-zinc-800` with RefreshCw icon. Spins while loading. onClick calls `fetchPosts()` then `runAnalysis()`.
  - Last refreshed timestamp in `text-xs text-zinc-500`

  **AI Summary Card:**
  - Glass card at top spanning full width
  - Shows `analysis.summary` text
  - Loading state: shimmer/pulse animation with "Gemini is analyzing Reddit…"
  - Show post count badge: "Analyzed N posts across M subreddits"

  **Ticker Grid:**
  - CSS grid: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`
  - Map over `analysis.tickers` sorted by `mentions` desc
  - Render `<RedditTickerCard>` for each
  - Cross-reference with watchlist: fetch `/api/db?table=watchlist` or use a simple fetch to check

  **Posts Feed:**
  - Right sidebar, scrollable with `max-h-[calc(100vh-300px)] overflow-y-auto`
  - Custom thin scrollbar styling (already in globals.css)
  - Sort posts by `createdUtc` desc (newest first)
  - Render `<RedditPostItem>` for each

  **On mount:** Call `fetchPosts()` then `runAnalysis()` via `useEffect`.

  **Empty/error states:**
  - No Reddit credentials: show setup instructions card
  - Error fetching: show error message with retry button
  - No results: "No posts found" placeholder

  Follow existing page patterns from `app/page.tsx` (screener) for styling consistency.

  **Commit:** `reddit-pulse: add Reddit Pulse page`

---

## Phase 6 — Nav Integration (depends on Phase 5)

- [ ] **6.1 — Add Reddit Tab to Nav (`components/Nav.tsx`)**

  Modify `/Users/junius/git/optionsflow/components/Nav.tsx`:

  1. Add import: `import { Radio } from 'lucide-react'` (add to existing lucide import line)
  2. Add to the `links` array (insert after the Chat entry, before Database):
     ```typescript
     { href: '/reddit', label: 'Reddit', icon: Radio },
     ```

  **Commit:** `reddit-pulse: add Reddit tab to navigation`

---

## Phase 7 — Testing & Polish (depends on Phase 6)

- [ ] **7.1 — End-to-End Verification**

  1. Ensure `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` are set in `.env.local`
  2. Run `npm run dev` and navigate to `/reddit`
  3. Verify:
     - Subreddit pills render and are toggleable
     - Posts load from Reddit API (check Network tab)
     - Gemini analysis runs and displays ticker cards
     - Sentiment colors are correct (emerald=bullish, red=bearish)
     - Posts feed shows recent posts with highlighted tickers
     - "Open in Reddit" links work
     - Nav tab highlights correctly when on `/reddit`
     - Caching works (second refresh within 15min uses cache)
  4. Fix any issues found
  5. Take a screenshot of the working page

  **Commit:** `reddit-pulse: final polish and verification`
