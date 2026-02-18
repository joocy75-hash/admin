'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export type Transaction = {
  id: number;
  uuid: string;
  user_id: number;
  user_username: string | null;
  type: string;
  action: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: string;
  reference_type: string | null;
  reference_id: string | null;
  memo: string | null;
  processed_by: number | null;
  processed_by_username: string | null;
  processed_at: string | null;
  created_at: string;
};

type TransactionListResponse = {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_amount: number;
};

type TransactionFilters = {
  page?: number;
  page_size?: number;
  type?: string;
  status?: string;
  user_id?: number;
};

export function useTransactionList(filters: TransactionFilters = {}) {
  const [data, setData] = useState<TransactionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.user_id) params.set('user_id', String(filters.user_id));
      const qs = params.toString();
      const result = await apiClient.get<TransactionListResponse>(
        `/api/v1/finance/transactions${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.type, filters.status, filters.user_id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export async function createDeposit(userId: number, amount: number, memo?: string) {
  return apiClient.post<Transaction>('/api/v1/finance/deposit', { user_id: userId, amount, memo });
}

export async function createWithdrawal(userId: number, amount: number, memo?: string) {
  return apiClient.post<Transaction>('/api/v1/finance/withdrawal', { user_id: userId, amount, memo });
}

export async function createAdjustment(userId: number, action: string, amount: number, memo?: string) {
  return apiClient.post<Transaction>('/api/v1/finance/adjustment', { user_id: userId, action, amount, memo });
}

export async function approveTransaction(id: number) {
  return apiClient.post<Transaction>(`/api/v1/finance/transactions/${id}/approve`, {});
}

export async function rejectTransaction(id: number, memo?: string) {
  return apiClient.post<Transaction>(`/api/v1/finance/transactions/${id}/reject`, { memo });
}
