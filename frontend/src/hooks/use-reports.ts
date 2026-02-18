'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type AgentReportItem = {
  agent_id: number;
  username: string;
  agent_code: string;
  role: string;
  total_users: number;
  total_bets: number;
  total_commissions: number;
};

export type CommissionReportItem = {
  type: string;
  total_amount: number;
  count: number;
};

export type FinancialReport = {
  total_deposits: number;
  total_withdrawals: number;
  net_revenue: number;
  total_commissions: number;
  deposit_count: number;
  withdrawal_count: number;
  start_date: string;
  end_date: string;
};

// ─── Hooks ───────────────────────────────────────────────────────

export function useAgentReport(startDate: string, endDate: string) {
  const [data, setData] = useState<AgentReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<AgentReportItem[]>(
        `/api/v1/reports/agents?start_date=${startDate}&end_date=${endDate}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent report');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useCommissionReport(startDate: string, endDate: string) {
  const [data, setData] = useState<CommissionReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<CommissionReportItem[]>(
        `/api/v1/reports/commissions?start_date=${startDate}&end_date=${endDate}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commission report');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useFinancialReport(startDate: string, endDate: string) {
  const [data, setData] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<FinancialReport>(
        `/api/v1/reports/financial?start_date=${startDate}&end_date=${endDate}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load financial report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Excel Export ────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002';

function getTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function downloadExcel(url: string, filename: string) {
  const token = getTokenFromStorage();
  const res = await fetch(`${API_BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export async function exportAgentReport(startDate: string, endDate: string) {
  await downloadExcel(
    `/api/v1/reports/agents/export?start_date=${startDate}&end_date=${endDate}`,
    `agent-report-${startDate}-${endDate}.xlsx`
  );
}

export async function exportCommissionReport(startDate: string, endDate: string) {
  await downloadExcel(
    `/api/v1/reports/commissions/export?start_date=${startDate}&end_date=${endDate}`,
    `commission-report-${startDate}-${endDate}.xlsx`
  );
}

export async function exportFinancialReport(startDate: string, endDate: string) {
  await downloadExcel(
    `/api/v1/reports/financial/export?start_date=${startDate}&end_date=${endDate}`,
    `financial-report-${startDate}-${endDate}.xlsx`
  );
}
