'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, API_BASE_URL, getToken } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type AuditLogItem = {
  id: number;
  admin_user_id: number | null;
  admin_username: string | null;
  action: string;
  module: string;
  resource_id: string | null;
  description: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

type AuditLogListResponse = {
  items: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
};

type AuditFilters = {
  page?: number;
  page_size?: number;
  action?: string;
  module?: string;
  admin_user_id?: number;
  start_date?: string;
  end_date?: string;
};

// ─── Hooks ───────────────────────────────────────────────────────

export function useAuditLogs(filters: AuditFilters = {}) {
  const [data, setData] = useState<AuditLogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.action) params.set('action', filters.action);
      if (filters.module) params.set('module', filters.module);
      if (filters.admin_user_id) params.set('admin_user_id', String(filters.admin_user_id));
      if (filters.start_date) params.set('start_date', filters.start_date);
      if (filters.end_date) params.set('end_date', filters.end_date);
      const qs = params.toString();
      const result = await apiClient.get<AuditLogListResponse>(
        `/api/v1/audit${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.action, filters.module, filters.admin_user_id, filters.start_date, filters.end_date]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useAuditLog(id: number | null) {
  const [data, setData] = useState<AuditLogItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiClient.get<AuditLogItem>(`/api/v1/audit/${id}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audit log'))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}

// ─── CSV Export ──────────────────────────────────────────────────

export async function exportAuditCSV(filters: AuditFilters = {}) {
  const params = new URLSearchParams();
  if (filters.action) params.set('action', filters.action);
  if (filters.module) params.set('module', filters.module);
  if (filters.admin_user_id) params.set('admin_user_id', String(filters.admin_user_id));
  if (filters.start_date) params.set('start_date', filters.start_date);
  if (filters.end_date) params.set('end_date', filters.end_date);
  const qs = params.toString();

  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/audit/export${qs ? `?${qs}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(blobUrl);
}
