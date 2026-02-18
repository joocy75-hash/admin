'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type VipLevel = {
  id: number;
  level: number;
  name: string;
  color: string;
  min_deposit: number;
  min_betting: number;
  rolling_bonus_rate: number;
  losing_bonus_rate: number;
  withdrawal_limit: number;
  daily_withdrawal_count: number;
  benefits_description: string | null;
  user_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type VipLevelListResponse = {
  items: VipLevel[];
  total: number;
};

export type VipLevelUser = {
  id: number;
  username: string;
  real_name: string | null;
  level: number;
  balance: number;
  total_deposit: number;
  total_bet: number;
  status: string;
  last_login_at: string | null;
  created_at: string;
};

type VipLevelUserListResponse = {
  items: VipLevelUser[];
  total: number;
  page: number;
  page_size: number;
};

export type UserLevelHistory = {
  id: number;
  user_id: number;
  from_level: number;
  to_level: number;
  reason: string;
  changed_by: number | null;
  changed_by_username: string | null;
  created_at: string;
};

type UserLevelHistoryResponse = {
  items: UserLevelHistory[];
  total: number;
};

type AutoCheckResult = {
  upgraded: number;
  downgraded: number;
  unchanged: number;
  details: { user_id: number; username: string; from_level: number; to_level: number }[];
};

// ─── VIP Level Hooks ─────────────────────────────────────────────

export function useVipLevels() {
  const [data, setData] = useState<VipLevelListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<VipLevelListResponse>('/api/v1/vip/levels');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load VIP levels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useVipLevel(id: number | null) {
  const [data, setData] = useState<VipLevel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get<VipLevel>(`/api/v1/vip/levels/${id}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}

export function useVipLevelUsers(level: number | null, page = 1, pageSize = 20) {
  const [data, setData] = useState<VipLevelUserListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (level === null) return;
    setLoading(true);
    try {
      const result = await apiClient.get<VipLevelUserListResponse>(
        `/api/v1/vip/levels/${level}/users?page=${page}&page_size=${pageSize}`
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [level, page, pageSize]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useUserLevelHistory(userId: number | null) {
  const [data, setData] = useState<UserLevelHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiClient.get<UserLevelHistoryResponse>(`/api/v1/vip/users/${userId}/history`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  return { data, loading };
}

export async function createVipLevel(body: Record<string, unknown>) {
  return apiClient.post<VipLevel>('/api/v1/vip/levels', body);
}

export async function updateVipLevel(id: number, body: Record<string, unknown>) {
  return apiClient.put<VipLevel>(`/api/v1/vip/levels/${id}`, body);
}

export async function deleteVipLevel(id: number) {
  return apiClient.delete(`/api/v1/vip/levels/${id}`);
}

export async function upgradeUser(userId: number, targetLevel: number, reason?: string) {
  return apiClient.post(`/api/v1/vip/users/${userId}/upgrade`, { target_level: targetLevel, reason });
}

export async function downgradeUser(userId: number, targetLevel: number, reason?: string) {
  return apiClient.post(`/api/v1/vip/users/${userId}/downgrade`, { target_level: targetLevel, reason });
}

export async function runAutoCheck() {
  return apiClient.post<AutoCheckResult>('/api/v1/vip/auto-check', {});
}
