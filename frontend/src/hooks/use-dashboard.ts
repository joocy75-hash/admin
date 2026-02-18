'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

export type DashboardStats = {
  total_agents: number;
  total_users: number;
  today_deposits: number;
  today_withdrawals: number;
  today_bets: number;
  today_commissions: number;
  total_balance: number;
  active_games: number;
  pending_deposits: number;
  pending_withdrawals: number;
};

export type RecentTransaction = {
  id: number;
  uuid: string;
  user_id: number;
  user_username: string | null;
  type: string;
  action: string;
  amount: number;
  status: string;
  created_at: string;
};

export type RecentCommission = {
  id: number;
  agent_id: number;
  agent_username: string | null;
  type: string;
  commission_amount: number;
  created_at: string;
};

export function useDashboardStats() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    setError(null);
    try {
      const result = await apiClient.get<DashboardStats>('/api/v1/dashboard/stats');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useRecentTransactions() {
  const [data, setData] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await apiClient.get<RecentTransaction[]>('/api/v1/dashboard/recent-transactions');
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useRecentCommissions() {
  const [data, setData] = useState<RecentCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await apiClient.get<RecentCommission[]>('/api/v1/dashboard/recent-commissions');
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch]);

  return { data, loading, refetch: fetch };
}
