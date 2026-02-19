'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ──────────────────────────────────────────────

export type AttendanceConfig = {
  id: number;
  day_number: number;
  reward_amount: number;
  reward_type: 'cash' | 'bonus' | 'point';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SpinPrize = {
  label: string;
  value: number;
  type: string;
  probability: number;
};

export type SpinConfig = {
  id: number;
  name: string;
  prizes: SpinPrize[];
  max_spins_daily: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PaybackConfig = {
  id: number;
  name: string;
  payback_percent: number;
  payback_type: string;
  period: 'daily' | 'weekly' | 'monthly';
  min_loss_amount: number;
  max_payback_amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DepositBonusConfig = {
  id: number;
  type: 'first_deposit' | 'every_deposit';
  bonus_percent: number;
  max_bonus_amount: number;
  min_deposit_amount: number;
  rollover_multiplier: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PointConfig = {
  id: number;
  key: string;
  value: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type ExchangeRate = {
  id: number;
  pair: string;
  rate: number;
  source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PopupNotice = {
  id: number;
  title: string;
  content: string;
  image_url: string | null;
  display_type: string;
  target: string;
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Mission = {
  id: number;
  name: string;
  description: string;
  rules: string;
  type: 'daily' | 'weekly' | 'monthly' | 'special';
  bonus_amount: number;
  max_participants: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminLoginLog = {
  id: number;
  admin_user_id: number;
  admin_username: string;
  ip_address: string;
  user_agent: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  logged_in_at: string;
};

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

// ─── Helpers ────────────────────────────────────────────

function buildParams(filters: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== '') params.set(key, String(val));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─── Hooks ──────────────────────────────────────────────

export function useAttendanceConfigs() {
  const [data, setData] = useState<AttendanceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items: AttendanceConfig[] }>('/api/v1/attendance/configs?page=1&page_size=100');
      setData(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '출석 설정 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useSpinConfigs() {
  const [data, setData] = useState<SpinConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items: SpinConfig[] }>('/api/v1/spin/configs?page=1&page_size=100');
      setData(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '룰렛 설정 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function usePaybackConfigs() {
  const [data, setData] = useState<PaybackConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items: PaybackConfig[] }>('/api/v1/payback/configs?page=1&page_size=100');
      setData(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '페이백 설정 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useDepositBonusConfigs() {
  const [data, setData] = useState<DepositBonusConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items: DepositBonusConfig[] }>('/api/v1/deposit-bonus/configs?page=1&page_size=100');
      setData(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '입금 보너스 설정 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function usePointConfigs() {
  const [data, setData] = useState<PointConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<PointConfig[]>('/api/v1/point-config');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '포인트 설정 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useExchangeRates() {
  const [data, setData] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ExchangeRate[]>('/api/v1/exchange-rates');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '환율 설정 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function usePopupNotices(page: number = 1, pageSize: number = 20) {
  const [data, setData] = useState<PopupNotice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildParams({ page, page_size: pageSize });
      const res = await apiClient.get<PaginatedResponse<PopupNotice>>(`/api/v1/popups${qs}`);
      setData(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '팝업 공지 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, total, loading, error, refetch: fetch };
}

export function useMissions(page: number = 1, pageSize: number = 20) {
  const [data, setData] = useState<Mission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildParams({ page, page_size: pageSize });
      const res = await apiClient.get<PaginatedResponse<Mission>>(`/api/v1/missions${qs}`);
      setData(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '미션 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, total, loading, error, refetch: fetch };
}

export function useAdminLogs(page: number = 1, pageSize: number = 20) {
  const [data, setData] = useState<AdminLoginLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildParams({ page, page_size: pageSize });
      const res = await apiClient.get<PaginatedResponse<AdminLoginLog>>(`/api/v1/admin-logs${qs}`);
      setData(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '관리자 로그인 로그 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, total, loading, error, refetch: fetch };
}

// ─── CRUD Actions ───────────────────────────────────────

// Attendance
export async function createAttendanceConfig(body: Omit<AttendanceConfig, 'id' | 'created_at' | 'updated_at'>) {
  return apiClient.post<AttendanceConfig>('/api/v1/attendance/configs', body);
}

export async function updateAttendanceConfig(id: number, body: Partial<Omit<AttendanceConfig, 'id' | 'created_at' | 'updated_at'>>) {
  return apiClient.put<AttendanceConfig>(`/api/v1/attendance/configs/${id}`, body);
}

// Spin
export async function createSpinConfig(body: Omit<SpinConfig, 'id' | 'created_at' | 'updated_at'>) {
  return apiClient.post<SpinConfig>('/api/v1/spin/configs', body);
}

export async function updateSpinConfig(id: number, body: Partial<Omit<SpinConfig, 'id' | 'created_at' | 'updated_at'>>) {
  return apiClient.put<SpinConfig>(`/api/v1/spin/configs/${id}`, body);
}

// Payback
export async function createPaybackConfig(body: Omit<PaybackConfig, 'id' | 'created_at' | 'updated_at'>) {
  return apiClient.post<PaybackConfig>('/api/v1/payback/configs', body);
}

export async function updatePaybackConfig(id: number, body: Partial<Omit<PaybackConfig, 'id' | 'created_at' | 'updated_at'>>) {
  return apiClient.put<PaybackConfig>(`/api/v1/payback/configs/${id}`, body);
}

// Deposit Bonus
export async function createDepositBonusConfig(body: Omit<DepositBonusConfig, 'id' | 'created_at' | 'updated_at'>) {
  return apiClient.post<DepositBonusConfig>('/api/v1/deposit-bonus/configs', body);
}

export async function updateDepositBonusConfig(id: number, body: Partial<Omit<DepositBonusConfig, 'id' | 'created_at' | 'updated_at'>>) {
  return apiClient.put<DepositBonusConfig>(`/api/v1/deposit-bonus/configs/${id}`, body);
}

// Point Config
export async function upsertPointConfig(key: string, body: { value: string; description?: string }) {
  return apiClient.put<PointConfig>(`/api/v1/point-config/${key}`, body);
}

// Exchange Rate
export async function createExchangeRate(body: Omit<ExchangeRate, 'id' | 'created_at' | 'updated_at'>) {
  return apiClient.post<ExchangeRate>('/api/v1/exchange-rates', body);
}

export async function updateExchangeRate(id: number, body: Partial<Omit<ExchangeRate, 'id' | 'created_at' | 'updated_at'>>) {
  return apiClient.put<ExchangeRate>(`/api/v1/exchange-rates/${id}`, body);
}

// Popup Notice
export async function createPopup(body: Omit<PopupNotice, 'id' | 'created_at' | 'updated_at'>) {
  return apiClient.post<PopupNotice>('/api/v1/popups', body);
}

export async function updatePopup(id: number, body: Partial<Omit<PopupNotice, 'id' | 'created_at' | 'updated_at'>>) {
  return apiClient.put<PopupNotice>(`/api/v1/popups/${id}`, body);
}

export async function deletePopup(id: number) {
  return apiClient.delete(`/api/v1/popups/${id}`);
}

// Mission
export async function createMission(body: Omit<Mission, 'id' | 'created_at' | 'updated_at'>) {
  return apiClient.post<Mission>('/api/v1/missions', body);
}

export async function updateMission(id: number, body: Partial<Omit<Mission, 'id' | 'created_at' | 'updated_at'>>) {
  return apiClient.put<Mission>(`/api/v1/missions/${id}`, body);
}

export async function deleteMission(id: number) {
  return apiClient.delete(`/api/v1/missions/${id}`);
}
