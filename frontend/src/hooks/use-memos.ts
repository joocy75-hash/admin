'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type AdminMemo = {
  id: number;
  target_type: string;
  target_id: number;
  content: string;
  created_by: number;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
};

export type MemoCreate = {
  target_type: string;
  target_id: number;
  content: string;
};

type MemoListResponse = {
  items: AdminMemo[];
  total: number;
};

// ─── List Hook ───────────────────────────────────────────────────

export function useMemos(targetType: string, targetId: number) {
  const [data, setData] = useState<MemoListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('target_type', targetType);
      params.set('target_id', String(targetId));
      const qs = params.toString();
      const result = await apiClient.get<MemoListResponse>(
        `/api/v1/memos?${qs}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memos');
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Recent Memos Hook ──────────────────────────────────────────

export function useRecentMemos() {
  const [data, setData] = useState<AdminMemo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<AdminMemo[]>('/api/v1/memos/recent');
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

// ─── Mutations ───────────────────────────────────────────────────

export async function createMemo(data: MemoCreate) {
  return apiClient.post<AdminMemo>('/api/v1/memos', data);
}

export async function updateMemo(id: number, content: string) {
  return apiClient.put<AdminMemo>(`/api/v1/memos/${id}`, { content });
}

export async function deleteMemo(id: number) {
  return apiClient.delete(`/api/v1/memos/${id}`);
}
