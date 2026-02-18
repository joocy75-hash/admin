'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export type Agent = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  agent_code: string;
  status: string;
  depth: number;
  parent_id: number | null;
  max_sub_agents: number;
  rolling_rate: number | null;
  losing_rate: number | null;
  deposit_rate: number | null;
  balance: number;
  pending_balance: number;
  two_factor_enabled: boolean;
  last_login_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
  children_count: number;
};

type AgentListResponse = {
  items: Agent[];
  total: number;
  page: number;
  page_size: number;
};

type AgentTreeNode = {
  id: number;
  username: string;
  agent_code: string;
  role: string;
  status: string;
  depth: number;
  parent_id: number | null;
  balance: number;
};

type AgentFilters = {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  status?: string;
  parent_id?: number | null;
};

export function useAgentList(filters: AgentFilters = {}) {
  const [data, setData] = useState<AgentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.search) params.set('search', filters.search);
      if (filters.role) params.set('role', filters.role);
      if (filters.status) params.set('status', filters.status);
      if (filters.parent_id != null) params.set('parent_id', String(filters.parent_id));

      const qs = params.toString();
      const result = await apiClient.get<AgentListResponse>(`/api/v1/agents${qs ? `?${qs}` : ''}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.search, filters.role, filters.status, filters.parent_id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useAgent(id: number | null) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get<Agent>(`/api/v1/agents/${id}`)
      .then(setAgent)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [id]);

  return { agent, loading, error };
}

export function useAgentTree(id: number | null) {
  const [nodes, setNodes] = useState<AgentTreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get<{ nodes: AgentTreeNode[] }>(`/api/v1/agents/${id}/tree`)
      .then((d) => setNodes(d.nodes))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return { nodes, loading };
}

export async function createAgent(body: Record<string, unknown>) {
  return apiClient.post<Agent>('/api/v1/agents', body);
}

export async function updateAgent(id: number, body: Record<string, unknown>) {
  return apiClient.put<Agent>(`/api/v1/agents/${id}`, body);
}

export async function deleteAgent(id: number) {
  return apiClient.delete(`/api/v1/agents/${id}`);
}

export async function resetAgentPassword(id: number, newPassword: string) {
  return apiClient.post(`/api/v1/agents/${id}/reset-password`, { new_password: newPassword });
}

// ─── Commission Rates (Hierarchical) ────────────────────

export type AgentCommissionRate = {
  id: number;
  agent_id: number;
  game_category: string;
  commission_type: string;
  rate: number;
  updated_at: string;
  agent_username: string | null;
  agent_code: string | null;
};

export function useAgentCommissionRates(agentId: number | null, commissionType?: string) {
  const [rates, setRates] = useState<AgentCommissionRate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const params = commissionType ? `?commission_type=${commissionType}` : '';
      const result = await apiClient.get<AgentCommissionRate[]>(
        `/api/v1/agents/${agentId}/commission-rates${params}`
      );
      setRates(result);
    } catch { setRates([]); }
    finally { setLoading(false); }
  }, [agentId, commissionType]);

  useEffect(() => { fetch(); }, [fetch]);

  return { rates, loading, refetch: fetch };
}

export function useSubAgentRates(agentId: number | null, gameCategory?: string) {
  const [rates, setRates] = useState<AgentCommissionRate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const params = gameCategory ? `?game_category=${gameCategory}` : '';
      const result = await apiClient.get<AgentCommissionRate[]>(
        `/api/v1/agents/${agentId}/sub-agent-rates${params}`
      );
      setRates(result);
    } catch { setRates([]); }
    finally { setLoading(false); }
  }, [agentId, gameCategory]);

  useEffect(() => { fetch(); }, [fetch]);

  return { rates, loading, refetch: fetch };
}

export async function setAgentCommissionRate(
  agentId: number,
  gameCategory: string,
  commissionType: string,
  rate: number,
) {
  return apiClient.put<AgentCommissionRate>(
    `/api/v1/agents/${agentId}/commission-rates`,
    { game_category: gameCategory, commission_type: commissionType, rate }
  );
}

export async function setAgentCommissionRatesBulk(
  agentId: number,
  rates: { game_category: string; commission_type: string; rate: number }[],
) {
  return apiClient.put<AgentCommissionRate[]>(
    `/api/v1/agents/${agentId}/commission-rates/bulk`,
    { rates }
  );
}
