import { getBroker } from '@/lib/broker-factory';
import { getQueueItems, getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isActive = true;

      const sendEvent = (event: string, data: unknown) => {
        if (!isActive) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { isActive = false; }
      };

      const getMarketStatus = () => {
        const now = new Date();
        const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const hours = et.getHours();
        const minutes = et.getMinutes();
        const dayOfWeek = et.getDay();
        const timeMinutes = hours * 60 + minutes;
        if (dayOfWeek === 0 || dayOfWeek === 6) return { status: 'CLOSED', message: 'Weekend' };
        if (timeMinutes < 240) return { status: 'CLOSED', message: 'Pre-market opens at 4:00 AM ET' };
        if (timeMinutes < 570) return { status: 'PRE_MARKET', message: 'Market opens at 9:30 AM ET' };
        if (timeMinutes < 960) return { status: 'OPEN', message: 'Market closes at 4:00 PM ET' };
        if (timeMinutes < 1200) return { status: 'AFTER_HOURS', message: 'After-hours ends at 8:00 PM ET' };
        return { status: 'CLOSED', message: 'Market opens at 9:30 AM ET' };
      };

      const getTrackedSymbols = (): string[] => {
        const symbols = new Set<string>();
        try {
          const queueItems = getQueueItems();
          queueItems.forEach(item => symbols.add(item.symbol));
          const db = getDb();
          const positions = db.prepare("SELECT DISTINCT symbol FROM trade_history WHERE status = 'FILLED' AND closed_at IS NULL").all() as { symbol: string }[];
          positions.forEach(p => symbols.add(p.symbol));
        } catch { /* empty */ }
        // Always include market benchmarks
        if (symbols.size === 0) { symbols.add('SPY'); symbols.add('QQQ'); }
        return Array.from(symbols);
      };

      sendEvent('market_status', getMarketStatus());

      const pollInterval = setInterval(async () => {
        if (!isActive) { clearInterval(pollInterval); return; }
        try {
          const broker = getBroker();
          const symbols = getTrackedSymbols();
          if (symbols.length > 0) {
            const quotes = await broker.getQuotes(symbols);
            sendEvent('quotes', quotes);
          }
          sendEvent('market_status', getMarketStatus());
        } catch (error) {
          const msg = error instanceof Error ? error.message : '';
          // Suppress known non-actionable errors
          if (!msg.includes('tokens found') && !msg.includes('auth-setup')
            && !msg.includes('Insufficient permission') && !msg.includes('INVALID_SYMBOL')
            && !msg.includes('Yahoo quote failed')) {
            console.error('[SSE] Poll error:', error);
          }
        }
      }, 15000);

      const heartbeatInterval = setInterval(() => {
        if (!isActive) { clearInterval(heartbeatInterval); return; }
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); } catch { isActive = false; }
      }, 30000);

      const checkClosed = setInterval(() => {
        try { controller.enqueue(encoder.encode('')); } catch {
          isActive = false;
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          clearInterval(checkClosed);
        }
      }, 5000);
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}
