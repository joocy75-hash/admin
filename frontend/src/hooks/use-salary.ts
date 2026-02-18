'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type SalaryConfig = {
  id: number;
  agent_id: number;
  agent_username: string | null;
  agent_code: string | null;
  salary_type: string;
  base_amount: number;
  min_active_users: number;
  min_betting_amount: number;
  min_deposit_amount: number;
  performance_bonus_rate: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type SalaryConfigListResponse = {
  items: SalaryConfig[];
  total: number;
};

export type SalaryPayment = {
  id: number;
  agent_id: number;
  agent_username: string | null;
  agent_code: string | null;
  config_id: number;
  salary_type: string;
  period_start: string;
  period_end: string;
  base_amount: number;
  performance_bonus: number;
  deductions: number;
  total_amount: number;
  status: string;
  approved_by: number | null;
  approved_by_username: string | null;
  paid_at: string | null;
  memo: string | null;
  created_at: string;
};

type SalaryPaymentListResponse = {
  items: SalaryPayment[];
  total: number;
  page: number;
  page_size: number;
};

export type SalaryPaymentSummary = {
  pending_count: number;
  pending_amount: number;
  approved_count: number;
  approved_amount: number;
  paid_count: number;
  paid_amount: number;
  monthly_paid_total: number;
};

type PaymentFilters = {
  page?: number;
  page_size?: number;
  agent_id?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
};

// ─── Config Hooks ────────────────────────────────────────────────

export function useSalaryConfigs(agentId?: number) {
  const [data, setData] = useState<SalaryConfigListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (agentId) params.set('agent_id', String(agentId));
      const qs = params.toString();
      const result = await apiClient.get<SalaryConfigListResponse>(
        `/api/v1/salary/configs${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load salary configs');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export async function createSalaryConfig(body: Record<string, unknown>) {
  return apiClient.post<SalaryConfig>('/api/v1/salary/configs', body);
}

export async function updateSalaryConfig(id: number, body: Record<string, unknown>) {
  return apiClient.put<SalaryConfig>(`/api/v1/salary/configs/${id}`, body);
}

export async function deleteSalaryConfig(id: number) {
  return apiClient.delete(`/api/v1/salary/configs/${id}`);
}

// ─── Payment Hooks ───────────────────────────────────────────────

export function useSalaryPayments(filters: PaymentFilters = {}) {
  const [data, setData] = useState<SalaryPaymentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.agent_id) params.set('agent_id', String(filters.agent_id));
      if (filters.status) params.set('status', filters.status);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      const qs = params.toString();
      const result = await apiClient.get<SalaryPaymentListResponse>(
        `/api/v1/salary/payments${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load salary payments');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.agent_id, filters.status, filters.date_from, filters.date_to]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useSalaryPaymentSummary() {
  const [data, setData] = useState<SalaryPaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<SalaryPaymentSummary>('/api/v1/salary/payments/summary');
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export async function createSalaryPayment(body: Record<string, unknown>) {
  return apiClient.post<SalaryPayment>('/api/v1/salary/payments', body);
}

export async function approveSalaryPayment(id: number) {
  return apiClient.post<SalaryPayment>(`/api/v1/salary/payments/${id}/approve`, {});
}

export async function paySalaryPayment(id: number) {
  return apiClient.post<SalaryPayment>(`/api/v1/salary/payments/${id}/pay`, {});
}

export async function rejectSalaryPayment(id: number, memo?: string) {
  return apiClient.post<SalaryPayment>(`/api/v1/salary/payments/${id}/reject`, { memo });
}
