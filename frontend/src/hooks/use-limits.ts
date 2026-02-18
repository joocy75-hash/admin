'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type TransactionLimit = {
  id: number;
  scope_type: string;
  scope_id: number | null;
  type: string;
  min_amount: number;
  max_amount: number;
  daily_limit: number;
  daily_count_limit: number;
  monthly_limit: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  scope_name: string | null;
};

type TransactionLimitListResponse = {
  items: TransactionLimit[];
  total: number;
};

export type EffectiveTransactionLimit = {
  type: string;
  min_amount: number;
  max_amount: number;
  daily_limit: number;
  daily_count_limit: number;
  monthly_limit: number;
  source: string;
};

export type BettingLimit = {
  id: number;
  scope_type: string;
  scope_id: number | null;
  game_category: string;
  min_bet: number;
  max_bet: number;
  daily_loss_limit: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  scope_name: string | null;
};

type BettingLimitListResponse = {
  items: BettingLimit[];
  total: number;
};

export type EffectiveBettingLimit = {
  game_category: string;
  min_bet: number;
  max_bet: number;
  daily_loss_limit: number;
  source: string;
};

// ─── Transaction Limit Hooks ─────────────────────────────────────

export function useTransactionLimits(scopeType?: string) {
  const [data, setData] = useState<TransactionLimitListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (scopeType) params.set('scope_type', scopeType);
      const qs = params.toString();
      const result = await apiClient.get<TransactionLimitListResponse>(
        `/api/v1/limits/transaction${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction limits');
    } finally {
      setLoading(false);
    }
  }, [scopeType]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useEffectiveTransactionLimits(userId: number) {
  const [data, setData] = useState<EffectiveTransactionLimit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiClient.get<EffectiveTransactionLimit[]>(`/api/v1/limits/transaction/effective/${userId}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return { data, loading };
}

export async function createTransactionLimit(body: Record<string, unknown>) {
  return apiClient.post<TransactionLimit>('/api/v1/limits/transaction', body);
}

export async function updateTransactionLimit(id: number, body: Record<string, unknown>) {
  return apiClient.put<TransactionLimit>(`/api/v1/limits/transaction/${id}`, body);
}

export async function deleteTransactionLimit(id: number) {
  return apiClient.delete(`/api/v1/limits/transaction/${id}`);
}

// ─── Betting Limit Hooks ─────────────────────────────────────────

export function useBettingLimits(scopeType?: string, gameCategory?: string) {
  const [data, setData] = useState<BettingLimitListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (scopeType) params.set('scope_type', scopeType);
      if (gameCategory) params.set('game_category', gameCategory);
      const qs = params.toString();
      const result = await apiClient.get<BettingLimitListResponse>(
        `/api/v1/limits/betting${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load betting limits');
    } finally {
      setLoading(false);
    }
  }, [scopeType, gameCategory]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useEffectiveBettingLimits(userId: number) {
  const [data, setData] = useState<EffectiveBettingLimit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiClient.get<EffectiveBettingLimit[]>(`/api/v1/limits/betting/effective/${userId}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return { data, loading };
}

export async function createBettingLimit(body: Record<string, unknown>) {
  return apiClient.post<BettingLimit>('/api/v1/limits/betting', body);
}

export async function updateBettingLimit(id: number, body: Record<string, unknown>) {
  return apiClient.put<BettingLimit>(`/api/v1/limits/betting/${id}`, body);
}

export async function deleteBettingLimit(id: number) {
  return apiClient.delete(`/api/v1/limits/betting/${id}`);
}
