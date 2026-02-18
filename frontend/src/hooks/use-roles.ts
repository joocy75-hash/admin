'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type PermissionItem = {
  id: number;
  name: string;
  module: string;
  description: string | null;
};

export type RoleItem = {
  id: number;
  name: string;
  display_name: string | null;
  description: string | null;
  is_system: boolean;
  permissions: PermissionItem[];
  permission_count: number;
  created_at: string;
  updated_at: string;
};

type RoleListResponse = {
  items: RoleItem[];
  total: number;
};

// ─── Hooks ───────────────────────────────────────────────────────

export function useRoles() {
  const [data, setData] = useState<RoleListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<RoleListResponse>('/api/v1/settings/roles');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useRole(id: number | null) {
  const [data, setData] = useState<RoleItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiClient.get<RoleItem>(`/api/v1/settings/roles/${id}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load role'))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}

export function usePermissions() {
  const [data, setData] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<PermissionItem[]>('/api/v1/settings/permissions');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error };
}

// ─── Mutations ───────────────────────────────────────────────────

export async function createRole(body: Record<string, unknown>) {
  return apiClient.post<RoleItem>('/api/v1/settings/roles', body);
}

export async function updateRole(id: number, body: Record<string, unknown>) {
  return apiClient.put<RoleItem>(`/api/v1/settings/roles/${id}`, body);
}

export async function deleteRole(id: number) {
  return apiClient.delete(`/api/v1/settings/roles/${id}`);
}

export async function updateRolePermissions(id: number, permissionIds: number[]) {
  return apiClient.put<RoleItem>(`/api/v1/settings/roles/${id}/permissions`, { permission_ids: permissionIds });
}
