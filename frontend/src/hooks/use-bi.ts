'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type BiOverview = {
  total_users: number;
  active_today: number;
  deposits_today: number;
  withdrawals_today: number;
  net_revenue_today: number;
  bets_today: number;
  new_registrations: number;
  pending_withdrawals: number;
};

export type RevenueSummary = {
  total_deposits: number;
  total_withdrawals: number;
  net_revenue: number;
  prev_deposits: number;
  prev_withdrawals: number;
  prev_net_revenue: number;
};

export type RevenueTrend = {
  date: string;
  deposits: number;
  withdrawals: number;
  net_revenue: number;
  cumulative: number;
};

export type UserRetention = {
  new_users: number;
  active_users: number;
  total_users: number;
  active_rate: number;
  churn_rate: number;
};

export type CohortData = {
  cohort_month: string;
  month_0: number;
  month_1: number;
  month_2: number;
  month_3: number;
};

export type GamePerformance = {
  game_name: string;
  total_bet: number;
  total_win: number;
  rtp: number;
  player_count: number;
  avg_bet: number;
};

export type AgentPerformance = {
  agent_name: string;
  sub_count: number;
  total_deposit: number;
  total_bet: number;
  commission: number;
  net_revenue: number;
};

// ─── Overview Hook (auto-refresh) ────────────────────────────────

export function useBiOverview() {
  const [data, setData] = useState<BiOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await apiClient.get<BiOverview>('/api/v1/bi/overview');
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch]);

  return { data, loading, refetch: fetch };
}

// ─── Revenue Hooks ──────────────────────────────────────────────

export function useRevenueSummary(period: string = 'today') {
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<RevenueSummary>(
        `/api/v1/bi/revenue?period=${period}`
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useRevenueTrend(days: number = 30) {
  const [data, setData] = useState<RevenueTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<RevenueTrend[]>(
        `/api/v1/bi/revenue/trend?days=${days}`
      );
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

// ─── User Analytics Hooks ───────────────────────────────────────

export function useUserRetention(period: string = 'month') {
  const [data, setData] = useState<UserRetention | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<UserRetention>(
        `/api/v1/bi/users/retention?period=${period}`
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useUserCohort() {
  const [data, setData] = useState<CohortData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<CohortData[]>('/api/v1/bi/users/cohort');
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

// ─── Performance Hooks ──────────────────────────────────────────

export function useGamePerformance(startDate?: string, endDate?: string) {
  const [data, setData] = useState<GamePerformance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const qs = params.toString();
      const result = await apiClient.get<GamePerformance[]>(
        `/api/v1/bi/games/performance${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useAgentPerformance(startDate?: string, endDate?: string) {
  const [data, setData] = useState<AgentPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const qs = params.toString();
      const result = await apiClient.get<AgentPerformance[]>(
        `/api/v1/bi/agents/performance${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}
