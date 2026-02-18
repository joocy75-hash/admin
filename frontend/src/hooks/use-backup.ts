'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type BackupItem = {
  id: number;
  filename: string;
  size: number;
  status: 'completed' | 'in_progress' | 'failed';
  created_at: string;
};

export type BackupSettings = {
  auto_backup: boolean;
  schedule: 'daily' | 'weekly' | 'monthly';
  retention_days: number;
  backup_path: string;
};

type BackupListResponse = {
  items: BackupItem[];
  total: number;
};

// ─── List Hook ──────────────────────────────────────────────────

export function useBackupList() {
  const [data, setData] = useState<BackupListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<BackupListResponse>('/api/v1/backup/list');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backup list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Settings Hook ──────────────────────────────────────────────

export function useBackupSettings() {
  const [data, setData] = useState<BackupSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<BackupSettings>('/api/v1/backup/settings');
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

// ─── Mutations ───────────────────────────────────────────────────

export async function createBackup() {
  return apiClient.post<BackupItem>('/api/v1/backup/create');
}

export async function updateBackupSettings(data: Partial<BackupSettings>) {
  return apiClient.put<BackupSettings>('/api/v1/backup/settings', data);
}
