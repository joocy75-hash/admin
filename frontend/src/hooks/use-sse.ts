'use client';

import { useEffect, useRef } from 'react';
import { API_BASE_URL, getToken } from '@/lib/api-client';

export type SSEEvent = {
  type: string;
  data: unknown;
};

export function useSSE(onEvent?: (event: SSEEvent) => void) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let disposed = false;

    function connect() {
      const token = getToken();
      if (!token || disposed) return;

      const url = `${API_BASE_URL}/api/v1/events/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          onEventRef.current?.({ type: parsed.type || 'message', data: parsed });
        } catch {
          // Ignore unparseable messages
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!disposed) {
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        }
      };
    }

    connect();
    return () => {
      disposed = true;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);
}
