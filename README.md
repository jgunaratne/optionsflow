# OptionsFlow

OptionsFlow is a Next.js app for screening cash-secured put candidates, reviewing live account data, queueing trades, and submitting orders through supported broker integrations.

## What It Does

- Screens a watchlist for cash-secured put opportunities
- Scores candidates with an AI review layer
- Shows live account balances and positions
- Queues trades before submission
- Supports broker switching at runtime
- Runs a nightly screener job when started through the custom server

## Current Broker Support

- `schwab`
  - Full options chain market data
  - Account balances and positions
  - Order preview and submission
  - Browser-based OAuth flow in-app
- `webull`
  - Account balances and positions
  - Order preview and submission
  - Token creation / SMS verification flow
  - Price history and quote fallbacks via Yahoo Finance
- `snaptrade`
  - Optional account aggregation path
  - Read-only holdings support
  - Not exposed in the current UI broker switcher

## Requirements

- Node.js 20+
- npm
- A writable local SQLite database file
- Broker API credentials for the integrations you want to use

## Installation

```bash
npm install
```

## Environment

Create `optionsflow/.env.local` and set the variables you need.

### Core

```bash
TOKEN_ENCRYPTION_KEY=your-secret-key
ACTIVE_BROKER=schwab
DATABASE_PATH=/absolute/path/to/optionsflow.db
```

Notes:

- `TOKEN_ENCRYPTION_KEY` is required for encrypted token storage.
- `ACTIVE_BROKER` falls back to `schwab` if not set.
- `DATABASE_PATH` is optional. By default the app uses `optionsflow.db` in the repo root.

### Schwab

```bash
SCHWAB_CLIENT_ID=...
SCHWAB_CLIENT_SECRET=...
SCHWAB_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

### Webull

```bash
WEBULL_APP_KEY=...
WEBULL_APP_SECRET=...
WEBULL_ACCOUNT_ID=...
```

Notes:

- `WEBULL_ACCOUNT_ID` is optional. The app will try to auto-discover an account.
- Webull access requires app-side verification through the Webull app.

### SnapTrade

```bash
SNAPTRADE_CLIENT_ID=...
SNAPTRADE_CONSUMER_KEY=...
```

## Running Locally

For normal local development:

```bash
npm run dev
```

This starts the Next.js dev server on `http://localhost:3000`.

Open:

- `http://localhost:3000/` for the screener
- `http://localhost:3000/positions` for positions and broker connection
- `http://localhost:3000/queue` for queued trades
- `http://localhost:3000/portfolio` for portfolio views
- `http://localhost:3000/chat` for AI chat

## Broker Authentication

### Schwab

Schwab uses an in-app browser OAuth popup from the Positions page.

Required:

- `SCHWAB_CLIENT_ID`
- `SCHWAB_CLIENT_SECRET`
- `SCHWAB_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY`

The redirect URI configured in Schwab must match the app exactly, for example:

```bash
http://localhost:3000/api/auth/callback
```

There is also a legacy CLI helper:

```bash
npx tsx scripts/auth-setup.ts
```

### Webull

Webull is connected from the app through `Connect Webull`.

Flow:

1. The app creates a token.
2. You approve the request in the Webull app.
3. You click Connect again to confirm the token is now active.

There is also an older helper script in `scripts/auth-setup-webull.ts`, but the current app flow goes through the API route and UI.

## Screener Behavior

The screener currently depends on Schwab for options chain data.

Important:

- If Schwab is not connected, the screener will not run.
- IV Rank history is fetched through a non-Schwab path with Yahoo-backed fallback behavior.
- The screener writes candidates into the local SQLite database.

From the UI, click `Run Screener` on the home page.

## Nightly Cron Job

The repo includes a custom server in [server.ts](./server.ts) that schedules a nightly screener run at `20:00` server time.

This cron job only runs when the app is started through the custom server, not through `next dev`.

## Production

The repo includes a PM2 config:

```bash
pm2 start ecosystem.config.js
```

This runs `server.ts` via `tsx`, which keeps the nightly screener cron active.

## Data Storage

OptionsFlow stores data in a local SQLite database. Main tables include:

- `tokens`
- `watchlist`
- `candidates`
- `queue`
- `trade_history`
- `chat_history`
- `config`

## Notes

- Broker selection is persisted in the database config.
- Some market-data and account views degrade differently depending on the selected broker.
- SnapTrade support exists in the codebase but is not fully surfaced in the main UI.

## Documentation

- [Setup and Operations](./docs/SETUP.md)
