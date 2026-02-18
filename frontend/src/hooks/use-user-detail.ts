'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ──────────────────────────────────────────────

export type UserStatistics = {
  total_deposit: number;
  total_withdrawal: number;
  total_bet: number;
  total_win: number;
  net_profit: number;
  deposit_withdrawal_diff: number;
};

export type WalletAddress = {
  id: number;
  coin_type: string;
  network: string;
  address: string;
  label: string | null;
  is_primary: boolean;
  status: string;
};

export type BettingPermission = {
  id: number;
  game_category: string;
  is_allowed: boolean;
};

export type NullBettingConfig = {
  id: number;
  game_category: string;
  every_n_bets: number;
  inherit_to_children: boolean;
};

export type GameRollingRate = {
  id: number;
  game_category: string;
  provider: string | null;
  rolling_rate: number;
};

export type UserDetailData = {
  user: import('./use-users').GameUser & {
    nickname: string | null;
    color: string | null;
    registration_ip: string | null;
    deposit_address: string | null;
    deposit_network: string | null;
    total_deposit: number;
    total_withdrawal: number;
    total_bet: number;
    total_win: number;
    login_count: number;
    last_deposit_at: string | null;
    last_bet_at: string | null;
  };
  statistics: UserStatistics;
  wallet_addresses: WalletAddress[];
  betting_permissions: BettingPermission[];
  null_betting_configs: NullBettingConfig[];
  game_rolling_rates: GameRollingRate[];
};

export type BetRecord = {
  id: number;
  game_category: string;
  provider: string | null;
  game_name: string | null;
  round_id: string | null;
  bet_amount: number;
  win_amount: number;
  profit: number;
  status: string;
  bet_at: string;
  settled_at: string | null;
};

export type BetSummary = {
  total_bet: number;
  total_win: number;
  net_profit: number;
};

export type BetListResponse = {
  items: BetRecord[];
  total: number;
  page: number;
  page_size: number;
  summary: BetSummary;
};

export type MoneyLog = {
  id: number;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  reference_type: string | null;
  created_at: string;
};

export type MoneySummary = {
  current_balance: number;
  total_credit: number;
  total_debit: number;
};

export type MoneyLogListResponse = {
  items: MoneyLog[];
  total: number;
  page: number;
  page_size: number;
  summary: MoneySummary;
};

export type PointLog = {
  id: number;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  reference_type: string | null;
  created_at: string;
};

export type PointSummary = {
  current_points: number;
  total_credit: number;
  total_debit: number;
};

export type PointLogListResponse = {
  items: PointLog[];
  total: number;
  page: number;
  page_size: number;
  summary: PointSummary;
};

export type LoginHistory = {
  id: number;
  login_ip: string;
  user_agent: string | null;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  country: string | null;
  city: string | null;
  login_at: string;
  logout_at: string | null;
};

export type LoginHistoryListResponse = {
  items: LoginHistory[];
  total: number;
  page: number;
  page_size: number;
};

export type InquiryReply = {
  id: number;
  admin_user_id: number;
  content: string;
  created_at: string;
};

export type Inquiry = {
  id: number;
  user_id: number;
  title: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
  replies: InquiryReply[];
};

export type InquirySummary = {
  total_count: number;
  pending_count: number;
  answered_count: number;
  closed_count: number;
};

export type InquiryListResponse = {
  items: Inquiry[];
  total: number;
  page: number;
  page_size: number;
  summary: InquirySummary;
};

export type Message = {
  id: number;
  sender_type: string;
  sender_id: number;
  receiver_type: string;
  receiver_id: number;
  title: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type MessageListResponse = {
  items: Message[];
  total: number;
  page: number;
  page_size: number;
};

// ─── Hooks ──────────────────────────────────────────────

export function useUserDetail(userId: number | null) {
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<UserDetailData>(`/api/v1/users/${userId}/detail`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user detail');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

type DateFilters = {
  page?: number;
  page_size?: number;
  date_from?: string;
  date_to?: string;
};

function buildParams(filters: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== '') params.set(key, String(val));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useUserBets(userId: number | null, filters: DateFilters & { game_category?: string } = {}) {
  const [data, setData] = useState<BetListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const qs = buildParams(filters);
      const result = await apiClient.get<BetListResponse>(`/api/v1/users/${userId}/bets${qs}`);
      setData(result);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [userId, filters.page, filters.page_size, filters.date_from, filters.date_to, filters.game_category]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useUserMoneyLogs(userId: number | null, filters: DateFilters & { type?: string } = {}) {
  const [data, setData] = useState<MoneyLogListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const qs = buildParams(filters);
      const result = await apiClient.get<MoneyLogListResponse>(`/api/v1/users/${userId}/money-logs${qs}`);
      setData(result);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [userId, filters.page, filters.page_size, filters.date_from, filters.date_to, filters.type]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useUserPointLogs(userId: number | null, filters: DateFilters & { type?: string } = {}) {
  const [data, setData] = useState<PointLogListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const qs = buildParams(filters);
      const result = await apiClient.get<PointLogListResponse>(`/api/v1/users/${userId}/point-logs${qs}`);
      setData(result);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [userId, filters.page, filters.page_size, filters.date_from, filters.date_to, filters.type]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useUserLoginHistory(userId: number | null, filters: DateFilters = {}) {
  const [data, setData] = useState<LoginHistoryListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const qs = buildParams(filters);
      const result = await apiClient.get<LoginHistoryListResponse>(`/api/v1/users/${userId}/login-history${qs}`);
      setData(result);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [userId, filters.page, filters.page_size, filters.date_from, filters.date_to]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useUserInquiries(userId: number | null, filters: DateFilters & { status?: string } = {}) {
  const [data, setData] = useState<InquiryListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const qs = buildParams(filters);
      const result = await apiClient.get<InquiryListResponse>(`/api/v1/users/${userId}/inquiries${qs}`);
      setData(result);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [userId, filters.page, filters.page_size, filters.date_from, filters.date_to, filters.status]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useUserMessages(userId: number | null, filters: DateFilters & { direction?: string } = {}) {
  const [data, setData] = useState<MessageListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const qs = buildParams(filters);
      const result = await apiClient.get<MessageListResponse>(`/api/v1/users/${userId}/messages${qs}`);
      setData(result);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [userId, filters.page, filters.page_size, filters.date_from, filters.date_to, filters.direction]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

// ─── Actions ────────────────────────────────────────────

export async function resetUserPassword(userId: number) {
  return apiClient.post(`/api/v1/users/${userId}/reset-password`);
}

export async function setUserPassword(userId: number, newPassword: string) {
  return apiClient.post(`/api/v1/users/${userId}/set-password`, { new_password: newPassword });
}

export async function suspendUser(userId: number, reason?: string) {
  return apiClient.post(`/api/v1/users/${userId}/suspend`, { reason });
}

export async function updateBettingPermission(userId: number, gameCategory: string, isAllowed: boolean) {
  return apiClient.put(`/api/v1/users/${userId}/betting-permissions`, [{ game_category: gameCategory, is_allowed: isAllowed }]);
}

export async function updateNullBettingConfig(userId: number, gameCategory: string, everyNBets: number, inheritToChildren: boolean) {
  return apiClient.put(`/api/v1/users/${userId}/null-betting`, [{ game_category: gameCategory, every_n_bets: everyNBets, inherit_to_children: inheritToChildren }]);
}

export async function updateGameRollingRate(userId: number, gameCategory: string, rollingRate: number, provider?: string) {
  return apiClient.put(`/api/v1/users/${userId}/rolling-rates`, [{ game_category: gameCategory, provider: provider || null, rolling_rate: rollingRate }]);
}

export async function createWalletAddress(userId: number, data: { coin_type: string; network: string; address: string; label?: string; is_primary?: boolean }) {
  return apiClient.post(`/api/v1/users/${userId}/wallet-addresses`, data);
}

export async function updateWalletAddress(userId: number, walletId: number, data: Record<string, unknown>) {
  return apiClient.put(`/api/v1/users/${userId}/wallet-addresses/${walletId}`, data);
}

export async function deleteWalletAddress(userId: number, walletId: number) {
  return apiClient.delete(`/api/v1/users/${userId}/wallet-addresses/${walletId}`);
}

export async function replyToInquiry(userId: number, inquiryId: number, content: string) {
  return apiClient.post(`/api/v1/users/${userId}/inquiries/${inquiryId}/reply`, { content });
}

export async function sendMessage(userId: number, title: string, content: string) {
  return apiClient.post(`/api/v1/users/${userId}/messages`, { title, content });
}

export async function markMessageRead(userId: number, messageId: number) {
  return apiClient.put(`/api/v1/users/${userId}/messages/${messageId}/read`);
}
