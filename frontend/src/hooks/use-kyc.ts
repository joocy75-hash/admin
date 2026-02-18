'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type KycDocument = {
  id: number;
  user_id: number;
  username: string;
  document_type: 'id_card' | 'passport' | 'driver_license' | 'utility_bill';
  document_number: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  front_image_url: string | null;
  back_image_url: string | null;
  selfie_image_url: string | null;
  reject_reason: string | null;
  reviewed_by: number | null;
  submitted_at: string;
  reviewed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KycStats = {
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  today_submitted: number;
};

export type KycUserStatus = {
  user_id: number;
  username: string;
  kyc_verified: boolean;
  documents: KycDocument[];
};

type KycDocumentListResponse = {
  items: KycDocument[];
  total: number;
  page: number;
  page_size: number;
};

// ─── Document Hooks ─────────────────────────────────────────────

export function useKycDocuments(page: number, pageSize: number, status?: string, userId?: number) {
  const [data, setData] = useState<KycDocumentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (status) params.set('status', status);
      if (userId) params.set('user_id', String(userId));
      const qs = params.toString();
      const result = await apiClient.get<KycDocumentListResponse>(
        `/api/v1/kyc/documents${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load KYC documents');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useKycDocument(id: number | null) {
  const [data, setData] = useState<KycDocument | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get<KycDocument>(`/api/v1/kyc/documents/${id}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}

export function useKycStats() {
  const [data, setData] = useState<KycStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<KycStats>('/api/v1/kyc/stats');
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

export function useKycPending(page: number, pageSize: number) {
  const [data, setData] = useState<KycDocumentListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      const qs = params.toString();
      const result = await apiClient.get<KycDocumentListResponse>(
        `/api/v1/kyc/pending${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useKycUserStatus(userId: number | null) {
  const [data, setData] = useState<KycUserStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiClient.get<KycUserStatus>(`/api/v1/kyc/users/${userId}/status`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  return { data, loading };
}

// ─── Mutations ───────────────────────────────────────────────────

export async function approveKycDocument(id: number) {
  return apiClient.post<KycDocument>(`/api/v1/kyc/documents/${id}/approve`);
}

export async function rejectKycDocument(id: number, reason: string) {
  return apiClient.post<KycDocument>(`/api/v1/kyc/documents/${id}/reject`, { reason });
}

export async function requestResubmit(id: number) {
  return apiClient.post<KycDocument>(`/api/v1/kyc/documents/${id}/request-resubmit`);
}
