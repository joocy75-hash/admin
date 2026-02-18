'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type FraudAlert = {
  id: number;
  user_id: number;
  user_username: string | null;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  description: string | null;
  data: Record<string, unknown> | null;
  detected_at: string;
  reviewed_by: number | null;
  reviewed_by_username: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
};

export type FraudStats = {
  total: number;
  critical: number;
  high: number;
  investigating: number;
  open: number;
  resolved_today: number;
};

export type FraudRule = {
  id: number;
  name: string;
  rule_type: string;
  condition: Record<string, unknown> | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_active: boolean;
  created_by: number;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
};

type FraudAlertListResponse = {
  items: FraudAlert[];
  total: number;
  page: number;
  page_size: number;
};

type FraudRuleListResponse = {
  items: FraudRule[];
  total: number;
};

type FraudAlertFilters = {
  page?: number;
  page_size?: number;
  severity?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
};

// ─── Alert Hooks ─────────────────────────────────────────────────

export function useFraudAlerts(filters: FraudAlertFilters = {}) {
  const [data, setData] = useState<FraudAlertListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.status) params.set('status', filters.status);
      if (filters.start_date) params.set('start_date', filters.start_date);
      if (filters.end_date) params.set('end_date', filters.end_date);
      const qs = params.toString();
      const result = await apiClient.get<FraudAlertListResponse>(
        `/api/v1/fraud/alerts${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fraud alerts');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.severity, filters.status, filters.start_date, filters.end_date]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useFraudAlertDetail(id: number | null) {
  const [data, setData] = useState<FraudAlert | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get<FraudAlert>(`/api/v1/fraud/alerts/${id}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}

export function useFraudStats() {
  const [data, setData] = useState<FraudStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<FraudStats>('/api/v1/fraud/stats');
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

// ─── Rule Hooks ──────────────────────────────────────────────────

export function useFraudRules() {
  const [data, setData] = useState<FraudRuleListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<FraudRuleListResponse>('/api/v1/fraud/rules');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fraud rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Mutations ───────────────────────────────────────────────────

export async function updateAlertStatus(id: number, status: string, resolutionNote?: string) {
  return apiClient.patch<FraudAlert>(`/api/v1/fraud/alerts/${id}/status`, {
    status,
    resolution_note: resolutionNote,
  });
}

export async function createFraudRule(body: Record<string, unknown>) {
  return apiClient.post<FraudRule>('/api/v1/fraud/rules', body);
}

export async function updateFraudRule(id: number, body: Record<string, unknown>) {
  return apiClient.put<FraudRule>(`/api/v1/fraud/rules/${id}`, body);
}

export async function deleteFraudRule(id: number) {
  return apiClient.delete(`/api/v1/fraud/rules/${id}`);
}

export async function toggleFraudRule(id: number, isActive: boolean) {
  return apiClient.put<FraudRule>(`/api/v1/fraud/rules/${id}`, { is_active: isActive });
}
