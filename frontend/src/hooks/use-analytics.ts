'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type RtpByGame = {
  game_id: number;
  game_name: string;
  provider_name: string;
  total_bet: number;
  total_win: number;
  rtp: number;
  bet_count: number;
};

export type RtpByProvider = {
  provider_id: number;
  provider_name: string;
  total_bet: number;
  total_win: number;
  rtp: number;
  bet_count: number;
  game_count: number;
};

export type RtpTrend = {
  date: string;
  total_bet: number;
  total_win: number;
  rtp: number;
  bet_count: number;
};

export type BulkOperationResult = {
  success_count: number;
  fail_count: number;
  errors: string[];
};

type RtpByGameResponse = {
  items: RtpByGame[];
  total: number;
};

type RtpByProviderResponse = {
  items: RtpByProvider[];
  total: number;
};

type RtpTrendResponse = {
  items: RtpTrend[];
};

// ─── RTP By Game Hook ───────────────────────────────────────────

export function useRtpByGame(startDate?: string, endDate?: string) {
  const [data, setData] = useState<RtpByGameResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const qs = params.toString();
      const result = await apiClient.get<RtpByGameResponse>(
        `/api/v1/analytics/rtp/by-game${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RTP data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── RTP By Provider Hook ───────────────────────────────────────

export function useRtpByProvider(startDate?: string, endDate?: string) {
  const [data, setData] = useState<RtpByProviderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const qs = params.toString();
      const result = await apiClient.get<RtpByProviderResponse>(
        `/api/v1/analytics/rtp/by-provider${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load provider RTP data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── RTP Trend Hook ─────────────────────────────────────────────

export function useRtpTrend(gameId?: number, days?: number) {
  const [data, setData] = useState<RtpTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (gameId) params.set('game_id', String(gameId));
      if (days) params.set('days', String(days));
      const qs = params.toString();
      const result = await apiClient.get<RtpTrendResponse>(
        `/api/v1/analytics/rtp/trend${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RTP trend');
    } finally {
      setLoading(false);
    }
  }, [gameId, days]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Bulk Mutations ─────────────────────────────────────────────

export async function bulkUpdateStatus(userIds: number[], newStatus: string, reason: string) {
  return apiClient.post<BulkOperationResult>('/api/v1/analytics/bulk/user-status', {
    user_ids: userIds,
    new_status: newStatus,
    reason,
  });
}

export async function bulkSendMessage(userIds: number[], title: string, content: string) {
  return apiClient.post<BulkOperationResult>('/api/v1/analytics/bulk/user-message', {
    user_ids: userIds,
    title,
    content,
  });
}

export async function bulkGrantPoints(userIds: number[], amount: number, type: string, reason: string) {
  return apiClient.post<BulkOperationResult>('/api/v1/analytics/bulk/user-points', {
    user_ids: userIds,
    amount,
    type,
    reason,
  });
}
