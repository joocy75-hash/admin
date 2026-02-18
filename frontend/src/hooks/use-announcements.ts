'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type AnnouncementItem = {
  id: number;
  type: string;
  title: string;
  content: string;
  target: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
};

type AnnouncementListResponse = {
  items: AnnouncementItem[];
  total: number;
  page: number;
  page_size: number;
};

type AnnouncementFilters = {
  page?: number;
  page_size?: number;
  type?: string;
  search?: string;
  is_active?: boolean;
};

// ─── Hooks ───────────────────────────────────────────────────────

export function useAnnouncements(filters: AnnouncementFilters = {}) {
  const [data, setData] = useState<AnnouncementListResponse | null>(null);
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
      if (filters.search) params.set('search', filters.search);
      if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));
      const qs = params.toString();
      const result = await apiClient.get<AnnouncementListResponse>(
        `/api/v1/content/announcements${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.type, filters.search, filters.is_active]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useAnnouncement(id: number | null) {
  const [data, setData] = useState<AnnouncementItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiClient.get<AnnouncementItem>(`/api/v1/content/announcements/${id}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load announcement'))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}

// ─── Mutations ───────────────────────────────────────────────────

export async function createAnnouncement(body: Record<string, unknown>) {
  return apiClient.post<AnnouncementItem>('/api/v1/content/announcements', body);
}

export async function updateAnnouncement(id: number, body: Record<string, unknown>) {
  return apiClient.put<AnnouncementItem>(`/api/v1/content/announcements/${id}`, body);
}

export async function deleteAnnouncement(id: number) {
  return apiClient.delete(`/api/v1/content/announcements/${id}`);
}
