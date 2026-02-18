'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export type Settlement = {
  id: number;
  uuid: string;
  agent_id: number;
  period_start: string;
  period_end: string;
  rolling_total: number;
  losing_total: number;
  deposit_total: number;
  sub_level_total: number;
  gross_total: number;
  deductions: number;
  net_total: number;
  status: string;
  confirmed_by: number | null;
  confirmed_at: string | null;
  paid_at: string | null;
  memo: string | null;
  created_at: string;
  agent_username: string | null;
  agent_code: string | null;
  confirmed_by_username: string | null;
};

type SettlementListResponse = {
  items: Settlement[];
  total: number;
  page: number;
  page_size: number;
};

export type SettlementPreview = {
  agent_id: number;
  agent_username: string;
  period_start: string;
  period_end: string;
  rolling_total: number;
  losing_total: number;
  deposit_total: number;
  gross_total: number;
  pending_entries: number;
};

type SettlementFilters = {
  page?: number;
  page_size?: number;
  agent_id?: number;
  status?: string;
};

export function useSettlementList(filters: SettlementFilters = {}) {
  const [data, setData] = useState<SettlementListResponse | null>(null);
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
      const qs = params.toString();
      const result = await apiClient.get<SettlementListResponse>(
        `/api/v1/settlements${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.agent_id, filters.status]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useSettlement(id: number | null) {
  const [data, setData] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get<Settlement>(`/api/v1/settlements/${id}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}

export async function previewSettlement(agentId: number, periodStart: string, periodEnd: string) {
  return apiClient.get<SettlementPreview>(
    `/api/v1/settlements/preview?agent_id=${agentId}&period_start=${periodStart}&period_end=${periodEnd}`
  );
}

export async function createSettlement(body: Record<string, unknown>) {
  return apiClient.post<Settlement>('/api/v1/settlements', body);
}

export async function confirmSettlement(id: number, memo?: string) {
  return apiClient.post<Settlement>(`/api/v1/settlements/${id}/confirm`, { memo });
}

export async function rejectSettlement(id: number, memo?: string) {
  return apiClient.post<Settlement>(`/api/v1/settlements/${id}/reject`, { memo });
}

export async function paySettlement(id: number) {
  return apiClient.post<Settlement>(`/api/v1/settlements/${id}/pay`, {});
}
