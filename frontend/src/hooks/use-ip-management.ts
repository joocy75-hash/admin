'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type IpRestriction = {
  id: number;
  ip_address: string;
  type: 'whitelist' | 'blacklist';
  description: string | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type IpRestrictionCreate = {
  ip_address: string;
  type: 'whitelist' | 'blacklist';
  description?: string;
};

export type IpCheckResult = {
  ip_address: string;
  allowed: boolean;
  matched_rule: IpRestriction | null;
};

export type IpStats = {
  whitelist_total: number;
  blacklist_total: number;
  active: number;
  inactive: number;
};

type IpRestrictionListResponse = {
  items: IpRestriction[];
  total: number;
  page: number;
  page_size: number;
};

// ─── List Hook ───────────────────────────────────────────────────

export function useIpRestrictions(page: number, pageSize: number, type?: string) {
  const [data, setData] = useState<IpRestrictionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (type) params.set('type', type);
      const qs = params.toString();
      const result = await apiClient.get<IpRestrictionListResponse>(
        `/api/v1/ip-management/restrictions${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IP restrictions');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, type]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Stats Hook ─────────────────────────────────────────────────

export function useIpStats() {
  const [data, setData] = useState<IpStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<IpStats>('/api/v1/ip-management/stats');
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

// ─── Mutations ───────────────────────────────────────────────────

export async function createIpRestriction(data: IpRestrictionCreate) {
  return apiClient.post<IpRestriction>('/api/v1/ip-management/restrictions', data);
}

export async function updateIpRestriction(id: number, data: Partial<IpRestrictionCreate>) {
  return apiClient.put<IpRestriction>(`/api/v1/ip-management/restrictions/${id}`, data);
}

export async function deleteIpRestriction(id: number) {
  return apiClient.delete(`/api/v1/ip-management/restrictions/${id}`);
}

export async function toggleIpRestriction(id: number) {
  return apiClient.post<IpRestriction>(`/api/v1/ip-management/restrictions/${id}/toggle`);
}

export async function checkIp(ip: string) {
  return apiClient.get<IpCheckResult>(`/api/v1/ip-management/check/${encodeURIComponent(ip)}`);
}

export async function bulkAddIps(ips: IpRestrictionCreate[]) {
  return apiClient.post<{ created: number; errors: string[] }>('/api/v1/ip-management/bulk-add', { items: ips });
}
