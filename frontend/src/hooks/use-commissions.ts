'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type CommissionPolicy = {
  id: number;
  name: string;
  type: string;
  level_rates: Record<string, number>;
  game_category: string | null;
  min_bet_amount: number;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

type PolicyListResponse = {
  items: CommissionPolicy[];
  total: number;
  page: number;
  page_size: number;
};

export type CommissionOverride = {
  id: number;
  admin_user_id: number;
  policy_id: number;
  custom_rates: Record<string, number> | null;
  active: boolean;
  created_at: string;
  agent_username: string | null;
  agent_code: string | null;
  policy_name: string | null;
};

export type LedgerEntry = {
  id: number;
  uuid: string;
  agent_id: number;
  user_id: number;
  policy_id: number;
  type: string;
  level: number;
  source_amount: number;
  rate: number;
  commission_amount: number;
  status: string;
  reference_type: string | null;
  reference_id: string | null;
  settlement_id: number | null;
  settled_at: string | null;
  description: string | null;
  created_at: string;
  agent_username: string | null;
  agent_code: string | null;
};

type LedgerListResponse = {
  items: LedgerEntry[];
  total: number;
  page: number;
  page_size: number;
  total_commission: number;
};

export type LedgerSummary = {
  type: string;
  total_amount: number;
  count: number;
};

type PolicyFilters = {
  page?: number;
  page_size?: number;
  type?: string;
  game_category?: string;
  active?: boolean;
};

type LedgerFilters = {
  page?: number;
  page_size?: number;
  agent_id?: number;
  type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
};

// ─── Policy Hooks ────────────────────────────────────────────────

export function usePolicyList(filters: PolicyFilters = {}) {
  const [data, setData] = useState<PolicyListResponse | null>(null);
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
      if (filters.game_category) params.set('game_category', filters.game_category);
      if (filters.active !== undefined) params.set('active', String(filters.active));

      const qs = params.toString();
      const result = await apiClient.get<PolicyListResponse>(
        `/api/v1/commissions/policies${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.type, filters.game_category, filters.active]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export async function createPolicy(body: Record<string, unknown>) {
  return apiClient.post<CommissionPolicy>('/api/v1/commissions/policies', body);
}

export async function updatePolicy(id: number, body: Record<string, unknown>) {
  return apiClient.put<CommissionPolicy>(`/api/v1/commissions/policies/${id}`, body);
}

export async function deletePolicy(id: number) {
  return apiClient.delete(`/api/v1/commissions/policies/${id}`);
}

// ─── Override Hooks ──────────────────────────────────────────────

export function useOverrides(agentId?: number, policyId?: number) {
  const [data, setData] = useState<CommissionOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (agentId) params.set('agent_id', String(agentId));
      if (policyId) params.set('policy_id', String(policyId));
      const qs = params.toString();
      const result = await apiClient.get<CommissionOverride[]>(
        `/api/v1/commissions/overrides${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [agentId, policyId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export async function createOverride(body: Record<string, unknown>) {
  return apiClient.post<CommissionOverride>('/api/v1/commissions/overrides', body);
}

export async function updateOverride(id: number, body: Record<string, unknown>) {
  return apiClient.put<CommissionOverride>(`/api/v1/commissions/overrides/${id}`, body);
}

export async function deleteOverride(id: number) {
  return apiClient.delete(`/api/v1/commissions/overrides/${id}`);
}

// ─── Ledger Hooks ────────────────────────────────────────────────

export function useLedger(filters: LedgerFilters = {}) {
  const [data, setData] = useState<LedgerListResponse | null>(null);
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
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);

      const qs = params.toString();
      const result = await apiClient.get<LedgerListResponse>(
        `/api/v1/commissions/ledger${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.agent_id, filters.type, filters.status, filters.date_from, filters.date_to]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useLedgerSummary(agentId?: number, dateFrom?: string, dateTo?: string) {
  const [data, setData] = useState<LedgerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (agentId) params.set('agent_id', String(agentId));
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString();
    apiClient.get<LedgerSummary[]>(`/api/v1/commissions/ledger/summary${qs ? `?${qs}` : ''}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [agentId, dateFrom, dateTo]);

  return { data, loading };
}
