'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type SettingItem = {
  id: number;
  group_name: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
};

export type SettingGroup = {
  group_name: string;
  items: SettingItem[];
};

// ─── Hooks ───────────────────────────────────────────────────────

export function useSettings() {
  const [data, setData] = useState<SettingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<SettingGroup[]>('/api/v1/settings');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Mutations ───────────────────────────────────────────────────

export async function updateSetting(group: string, key: string, value: string) {
  return apiClient.put<SettingItem>(`/api/v1/settings/${group}/${key}`, { value });
}

export async function bulkUpdateSettings(items: { group_name: string; key: string; value: string }[]) {
  return apiClient.put<SettingGroup[]>('/api/v1/settings/bulk', { items });
}
