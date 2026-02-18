'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type PartnerStats = {
  total_sub_users: number;
  total_sub_agents: number;
  total_bet_amount: number;
  total_commission: number;
  month_settlement: number;
  month_bet_amount: number;
};

export type PartnerUser = {
  id: number;
  username: string;
  status: string;
  balance: number;
  total_bet: number;
  total_win: number;
  created_at: string;
};

type PartnerUserListResponse = {
  items: PartnerUser[];
  total: number;
  page: number;
  page_size: number;
};

export type PartnerCommission = {
  id: number;
  type: string;
  source_amount: number;
  rate: number;
  commission_amount: number;
  status: string;
  reference_id: string | null;
  created_at: string;
};

type PartnerCommissionListResponse = {
  items: PartnerCommission[];
  total: number;
  page: number;
  page_size: number;
  total_commission: number;
};

export type PartnerSettlement = {
  id: number;
  period_start: string;
  period_end: string;
  total_commission: number;
  status: string;
  paid_at: string | null;
  created_at: string;
};

type PartnerSettlementListResponse = {
  items: PartnerSettlement[];
  total: number;
  page: number;
  page_size: number;
};

export type PartnerTreeNode = {
  id: number;
  username: string;
  role: string;
  level: number;
  status: string;
  agent_code: string | null;
};

// ─── Dashboard Stats ────────────────────────────────────────────

export function usePartnerDashboard() {
  const [data, setData] = useState<PartnerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<PartnerStats>('/api/v1/partner/dashboard');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Users ──────────────────────────────────────────────────────

type PartnerUserFilters = {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
};

export function usePartnerUsers(filters: PartnerUserFilters = {}) {
  const [data, setData] = useState<PartnerUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      const qs = params.toString();
      const result = await apiClient.get<PartnerUserListResponse>(
        `/api/v1/partner/users${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner users');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.search, filters.status]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Commissions ────────────────────────────────────────────────

type PartnerCommissionFilters = {
  page?: number;
  page_size?: number;
  type?: string;
  date_from?: string;
  date_to?: string;
};

export function usePartnerCommissions(filters: PartnerCommissionFilters = {}) {
  const [data, setData] = useState<PartnerCommissionListResponse | null>(null);
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
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      const qs = params.toString();
      const result = await apiClient.get<PartnerCommissionListResponse>(
        `/api/v1/partner/commissions${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner commissions');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.type, filters.date_from, filters.date_to]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Settlements ────────────────────────────────────────────────

type PartnerSettlementFilters = {
  page?: number;
  page_size?: number;
  status?: string;
};

export function usePartnerSettlements(filters: PartnerSettlementFilters = {}) {
  const [data, setData] = useState<PartnerSettlementListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.status) params.set('status', filters.status);
      const qs = params.toString();
      const result = await apiClient.get<PartnerSettlementListResponse>(
        `/api/v1/partner/settlements${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner settlements');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.status]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Tree ───────────────────────────────────────────────────────

export function usePartnerTree() {
  const [data, setData] = useState<PartnerTreeNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<PartnerTreeNode[]>('/api/v1/partner/tree');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner tree');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
