'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type Promotion = {
  id: number;
  name: string;
  type: string;
  description: string | null;
  bonus_type: string;
  bonus_value: number;
  min_deposit: number;
  max_bonus: number;
  wagering_multiplier: number;
  target: string;
  target_value: string | null;
  max_claims_per_user: number;
  max_total_claims: number;
  total_claims: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PromotionParticipant = {
  id: number;
  user_id: number;
  username: string;
  nickname: string | null;
  bonus_amount: number;
  wagering_required: number;
  wagering_completed: number;
  status: string;
  claimed_at: string;
};

export type PromotionStats = {
  active_count: number;
  total_participants: number;
  total_bonus_paid: number;
};

export type PromotionDetailStats = {
  daily_claims: { date: string; count: number }[];
  total_bonus_paid: number;
  conversion_rate: number;
};

export type Coupon = {
  id: number;
  promotion_id: number;
  promotion_name: string | null;
  code: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

type PromotionListResponse = {
  items: Promotion[];
  total: number;
  page: number;
  page_size: number;
};

type ParticipantListResponse = {
  items: PromotionParticipant[];
  total: number;
  page: number;
  page_size: number;
};

type CouponListResponse = {
  items: Coupon[];
  total: number;
  page: number;
  page_size: number;
};

type PromotionFilters = {
  page?: number;
  page_size?: number;
  type?: string;
  is_active?: boolean;
};

type CouponFilters = {
  page?: number;
  page_size?: number;
  promotion_id?: number;
  is_active?: boolean;
};

// ─── Promotion Hooks ─────────────────────────────────────────────

export function usePromotions(filters: PromotionFilters = {}) {
  const [data, setData] = useState<PromotionListResponse | null>(null);
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
      if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));
      const qs = params.toString();
      const result = await apiClient.get<PromotionListResponse>(
        `/api/v1/promotions${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.type, filters.is_active]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function usePromotion(id: number | null) {
  const [data, setData] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiClient.get<Promotion>(`/api/v1/promotions/${id}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load promotion'))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}

export function usePromotionParticipants(id: number, page = 1) {
  const [data, setData] = useState<ParticipantListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', '20');
      const result = await apiClient.get<ParticipantListResponse>(
        `/api/v1/promotions/${id}/participants?${params.toString()}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [id, page]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function usePromotionStats() {
  const [data, setData] = useState<PromotionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<PromotionStats>('/api/v1/promotions/stats');
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

export function usePromotionDetailStats(id: number) {
  const [data, setData] = useState<PromotionDetailStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<PromotionDetailStats>(`/api/v1/promotions/${id}/stats`);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

// ─── Coupon Hooks ────────────────────────────────────────────────

export function useCoupons(filters: CouponFilters = {}) {
  const [data, setData] = useState<CouponListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.promotion_id) params.set('promotion_id', String(filters.promotion_id));
      if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));
      const qs = params.toString();
      const result = await apiClient.get<CouponListResponse>(
        `/api/v1/promotions/coupons${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.promotion_id, filters.is_active]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── User Promotion Hook ────────────────────────────────────────

export function useUserPromotions(userId: number) {
  const [data, setData] = useState<PromotionParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.get<{ items: PromotionParticipant[] }>(`/api/v1/users/${userId}/promotions`)
      .then((res) => setData(res.items))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return { data, loading };
}

// ─── Mutations ───────────────────────────────────────────────────

export async function createPromotion(body: Record<string, unknown>) {
  return apiClient.post<Promotion>('/api/v1/promotions', body);
}

export async function updatePromotion(id: number, body: Record<string, unknown>) {
  return apiClient.put<Promotion>(`/api/v1/promotions/${id}`, body);
}

export async function deletePromotion(id: number) {
  return apiClient.delete(`/api/v1/promotions/${id}`);
}

export async function togglePromotion(id: number) {
  return apiClient.post<Promotion>(`/api/v1/promotions/${id}/toggle`);
}

export async function claimPromotion(promotionId: number, data: { userId: number; depositAmount?: number }) {
  return apiClient.post(`/api/v1/promotions/${promotionId}/claim`, {
    user_id: data.userId,
    deposit_amount: data.depositAmount,
  });
}

export async function createCoupon(body: Record<string, unknown>) {
  return apiClient.post<Coupon>('/api/v1/promotions/coupons', body);
}

export async function batchCreateCoupons(data: { promotionId: number; count: number; prefix?: string }) {
  return apiClient.post<{ created: number }>('/api/v1/promotions/coupons/batch', {
    promotion_id: data.promotionId,
    count: data.count,
    prefix: data.prefix,
  });
}

export async function redeemCoupon(data: { userId: number; code: string }) {
  return apiClient.post('/api/v1/promotions/coupons/redeem', {
    user_id: data.userId,
    code: data.code,
  });
}

export async function deleteCoupon(id: number) {
  return apiClient.delete(`/api/v1/promotions/coupons/${id}`);
}
