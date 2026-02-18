'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type Notification = {
  id: number;
  type: 'transaction' | 'user' | 'system' | 'alert' | 'settlement';
  title: string;
  content: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  is_read: boolean;
  link: string | null;
  created_at: string;
};

type NotificationListResponse = {
  items: Notification[];
  total: number;
  page: number;
  page_size: number;
  unread_count: number;
};

type NotificationFilters = {
  page?: number;
  page_size?: number;
  type?: string;
  is_read?: boolean;
};

// ─── Hooks ───────────────────────────────────────────────────────

export function useNotifications(filters: NotificationFilters = {}) {
  const [data, setData] = useState<NotificationListResponse | null>(null);
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
      if (filters.is_read !== undefined) params.set('is_read', String(filters.is_read));
      const qs = params.toString();
      const result = await apiClient.get<NotificationListResponse>(
        `/api/v1/notifications${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.type, filters.is_read]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useUnreadCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const result = await apiClient.get<{ unread_count: number }>('/api/v1/notifications/unread-count');
      setCount(result.unread_count);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { count, loading, refetch: fetch };
}

export function useRecentNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const result = await apiClient.get<NotificationListResponse>(
        '/api/v1/notifications?page_size=5&page=1'
      );
      setItems(result.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { items, loading, refetch: fetch };
}

// ─── Mutations ───────────────────────────────────────────────────

export async function markAsRead(id: number) {
  return apiClient.post(`/api/v1/notifications/${id}/read`);
}

export async function markAllAsRead() {
  return apiClient.post('/api/v1/notifications/read-all');
}

export async function deleteNotification(id: number) {
  return apiClient.delete(`/api/v1/notifications/${id}`);
}
