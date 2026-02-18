'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type RealtimeStats = {
  online_users: number;
  pending_deposits: number;
  pending_withdrawals: number;
  today_profit: number;
};

export type LiveTransaction = {
  id: number;
  type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'commission' | 'transfer';
  username: string;
  amount: number;
  status: string;
  created_at: string;
};

type LiveTransactionListResponse = {
  items: LiveTransaction[];
};

export type ActiveAlert = {
  id: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  username: string;
  created_at: string;
};

type ActiveAlertsResponse = {
  items: ActiveAlert[];
  total: number;
};

export type SystemHealth = {
  database: 'ok' | 'degraded' | 'down';
  redis: 'ok' | 'degraded' | 'down';
  api: 'ok' | 'degraded' | 'down';
  last_checked: string;
};

// ─── Hooks ───────────────────────────────────────────────────────

export function useRealtimeStats(intervalMs = 10000) {
  const [data, setData] = useState<RealtimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setFetching(true);
    try {
      const result = await apiClient.get<RealtimeStats>('/api/v1/monitoring/realtime-stats');
      if (mountedRef.current) setData(result);
    } catch {
      // Silently fail for auto-refresh
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setFetching(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    const interval = setInterval(fetch, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetch, intervalMs]);

  return { data, loading, fetching, refetch: fetch };
}

export function useLiveTransactions(intervalMs = 5000) {
  const [items, setItems] = useState<LiveTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setFetching(true);
    try {
      const result = await apiClient.get<LiveTransactionListResponse>('/api/v1/monitoring/live-transactions?limit=20');
      if (mountedRef.current) setItems(result.items);
    } catch {
      // Silently fail
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setFetching(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    const interval = setInterval(fetch, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetch, intervalMs]);

  return { items, loading, fetching, refetch: fetch };
}

export function useActiveAlerts() {
  const [data, setData] = useState<ActiveAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<ActiveAlertsResponse>('/api/v1/monitoring/active-alerts');
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useSystemHealth() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<SystemHealth>('/api/v1/monitoring/health');
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { data, loading, refetch: fetch };
}
