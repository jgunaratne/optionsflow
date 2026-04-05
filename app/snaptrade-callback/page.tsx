'use client';

import { useEffect } from 'react';

/**
 * SnapTrade callback page — shown after user connects their brokerage.
 * If opened in a popup, closes itself. Otherwise redirects home.
 */
export default function SnapTradeCallbackPage() {
  useEffect(() => {
    // If in a popup, notify opener and close
    if (window.opener) {
      window.opener.postMessage({ type: 'snaptrade-connected' }, '*');
      window.close();
    } else {
      // Redirect to home after a short delay
      setTimeout(() => { window.location.href = '/'; }, 2000);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="mb-4 text-4xl">✅</div>
        <h1 className="mb-2 text-xl font-bold text-white">Brokerage Connected!</h1>
        <p className="text-sm text-zinc-400">You can close this window.</p>
      </div>
    </div>
  );
}
