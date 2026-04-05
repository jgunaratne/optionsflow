# Setup and Operations

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` in the repo root.

3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Recommended `.env.local`

```bash
TOKEN_ENCRYPTION_KEY=replace-me
ACTIVE_BROKER=schwab
DATABASE_PATH=/home/you/optionsflow/optionsflow.db

SCHWAB_CLIENT_ID=
SCHWAB_CLIENT_SECRET=
SCHWAB_REDIRECT_URI=http://localhost:3000/api/auth/callback

WEBULL_APP_KEY=
WEBULL_APP_SECRET=
WEBULL_ACCOUNT_ID=

SNAPTRADE_CLIENT_ID=
SNAPTRADE_CONSUMER_KEY=
```

## Broker Setup

### Schwab

Use the Positions page and click `Connect Schwab`.

What happens:

1. The app creates a PKCE verifier and OAuth state.
2. Schwab opens in a popup.
3. The callback stores encrypted tokens in SQLite.
4. The popup closes and the Positions page refreshes.

If the popup flow cannot be used, the repo still contains a CLI helper:

```bash
npx tsx scripts/auth-setup.ts
```

### Webull

Use the Positions page and click `Connect Webull`.

What happens:

1. The app creates or checks a Webull token.
2. You approve the request in the Webull app.
3. You click Connect again until the token status becomes active.

### SnapTrade

SnapTrade is API-accessible but not a primary UI path.

Relevant endpoints:

- `POST /api/snaptrade/register`
- `POST /api/snaptrade/connect`
- `GET /api/snaptrade/holdings`

## Screener Requirements

The screener is not broker-agnostic today.

Current behavior:

- Options chain data comes from Schwab.
- If Schwab is not connected, the screener exits early with a clear status message.
- IV Rank uses a separate price-history path with Yahoo-backed fallback behavior.

Operationally, that means:

- You can browse the UI without Schwab connected.
- You cannot run the options screener meaningfully until Schwab auth is completed.

## Nightly Job

The nightly screener job is scheduled in `server.ts` with:

```ts
cron.schedule('0 20 * * *', async () => {
  await runScreener();
});
```

This runs at `20:00` in the server's local timezone.

Important:

- `npm run dev` does not use `server.ts`
- `next start` does not use `server.ts`
- PM2 with `ecosystem.config.js` does use `server.ts`

## Production Startup

For a long-running process with the nightly cron active:

```bash
pm2 start ecosystem.config.js
```

## Useful Files

- `app/api/auth/connect/route.ts`
- `app/api/auth/callback/route.ts`
- `app/api/screener/run/route.ts`
- `lib/screener.ts`
- `lib/schwab.ts`
- `lib/webull.ts`
- `lib/snaptrade.ts`
- `lib/db.ts`

## Troubleshooting

### Schwab connect fails

Check:

- `SCHWAB_CLIENT_ID`
- `SCHWAB_CLIENT_SECRET`
- `SCHWAB_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY`
- the exact redirect URI configured in Schwab

### Screener says Schwab is not connected

That means no Schwab token is stored in the local database yet. Connect Schwab from the Positions page first.

### Webull token stays pending

Open the Webull app, approve the API request, then click Connect again.

### Data looks missing after switching brokers

The active broker affects account views, positions, execution, and some market-data behavior. Confirm the current broker in the top navigation switcher.
