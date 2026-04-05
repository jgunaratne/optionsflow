'use client';

import { useEffect, useRef } from 'react';
import { useStreamStore } from './store';

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const { setQuotes, setVix, setMarketStatus, setConnected } = useStreamStore();

  useEffect(() => {
    const connect = () => {
      const es = new EventSource('/api/stream');
      eventSourceRef.current = es;

      es.onopen = () => setConnected(true);

      es.addEventListener('quotes', (e) => {
        try {
          const data = JSON.parse(e.data);
          setQuotes(data);
          // Extract VIX
          if (data['$VIX.X']) {
            setVix(data['$VIX.X'].lastPrice || data['$VIX.X'].mark || 0);
          }
        } catch {}
      });

      es.addEventListener('market_status', (e) => {
        try {
          setMarketStatus(JSON.parse(e.data));
        } catch {}
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Reconnect after 5 seconds
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
      setConnected(false);
    };
  }, [setQuotes, setVix, setMarketStatus, setConnected]);
}
