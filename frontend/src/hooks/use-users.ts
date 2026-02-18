'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export type GameUser = {
  id: number;
  uuid: string;
  username: string;
  real_name: string | null;
  phone: string | null;
  email: string | null;
  referrer_id: number | null;
  referrer_username: string | null;
  depth: number;
  rank: string;
  balance: number;
  points: number;
  status: string;
  level: number;
  direct_referral_count: number;
  memo: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type UserListResponse = {
  items: GameUser[];
  total: number;
  page: number;
  page_size: number;
};

type UserFilters = {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  rank?: string;
  referrer_id?: number;
};

export type UserTreeNode = {
  id: number;
  username: string;
  rank: string;
  status: string;
  depth: number;
  referrer_id: number | null;
  balance: number;
  points: number;
};

type UserTreeResponse = {
  nodes: UserTreeNode[];
};

export function useUserList(filters: UserFilters = {}) {
  const [data, setData] = useState<UserListResponse | null>(null);
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
      if (filters.status) params.set('status', filters.status);
      if (filters.rank) params.set('rank', filters.rank);
      if (filters.referrer_id) params.set('referrer_id', String(filters.referrer_id));
      const qs = params.toString();
      const result = await apiClient.get<UserListResponse>(`/api/v1/users${qs ? `?${qs}` : ''}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.search, filters.status, filters.rank, filters.referrer_id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useUser(id: number | null) {
  const [data, setData] = useState<GameUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get<GameUser>(`/api/v1/users/${id}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}

export function useUserTree(userId: number | null) {
  const [nodes, setNodes] = useState<UserTreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiClient.get<UserTreeResponse>(`/api/v1/users/${userId}/tree`)
      .then((res) => setNodes(res.nodes))
      .catch(() => setNodes([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return { nodes, loading };
}

export type TreeFlatUser = GameUser & {
  treeDepth: number;
  hasChildren: boolean;
  isLastChild: boolean;
  connectorLines: boolean[]; // true at index i = draw │ at ancestor depth i
  childCount: number;
};

export function useUserTreeList() {
  const [items, setItems] = useState<TreeFlatUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all users (paginate if needed)
      const allUsers: GameUser[] = [];
      let page = 1;
      while (true) {
        const res = await apiClient.get<UserListResponse>(`/api/v1/users?page=${page}&page_size=100`);
        allUsers.push(...res.items);
        if (allUsers.length >= res.total) break;
        page++;
      }
      const res = { items: allUsers };
      const users = res.items;
      const childrenMap = new Map<number | null, GameUser[]>();
      for (const u of users) {
        const pid = u.referrer_id;
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid)!.push(u);
      }
      // Sort children by ID (chronological)
      for (const [, children] of childrenMap) {
        children.sort((a, b) => a.id - b.id);
      }

      const flat: TreeFlatUser[] = [];
      const visited = new Set<number>();

      // Count all descendants recursively
      const countDescendants = (parentId: number): number => {
        const children = childrenMap.get(parentId) || [];
        let count = children.length;
        for (const c of children) count += countDescendants(c.id);
        return count;
      };

      const dfs = (parentId: number | null, depth: number, ancestorLines: boolean[]) => {
        const children = childrenMap.get(parentId) || [];
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (visited.has(child.id)) continue;
          visited.add(child.id);
          const isLast = i === children.length - 1;
          const kids = childrenMap.get(child.id) || [];
          flat.push({
            ...child,
            treeDepth: depth,
            hasChildren: kids.length > 0,
            isLastChild: isLast,
            connectorLines: [...ancestorLines],
            childCount: countDescendants(child.id),
          });
          // Root-level nodes (parentId === null) belong to independent trees.
          // Never carry a cross-tree continuation line into their descendants.
          const continueForChild = parentId === null ? false : !isLast;
          dfs(child.id, depth + 1, [...ancestorLines, continueForChild]);
        }
      };
      dfs(null, 0, []);

      // Add orphans
      for (const u of users) {
        if (!visited.has(u.id)) {
          flat.push({
            ...u,
            treeDepth: 0,
            hasChildren: false,
            isLastChild: true,
            connectorLines: [],
            childCount: 0,
          });
        }
      }
      setItems(flat);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { items, loading, refetch: fetchData };
}

export type UserSummaryStats = {
  total_count: number;
  active_count: number;
  suspended_count: number;
  banned_count: number;
  pending_count: number;
  total_balance: number;
  total_points: number;
};

export function useUserSummaryStats() {
  const [data, setData] = useState<UserSummaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<UserSummaryStats>('/api/v1/users/summary-stats');
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

export async function createUser(body: Record<string, unknown>) {
  return apiClient.post<GameUser>('/api/v1/users', body);
}

export async function updateUser(id: number, body: Record<string, unknown>) {
  return apiClient.put<GameUser>(`/api/v1/users/${id}`, body);
}

export async function deleteUser(id: number) {
  return apiClient.delete(`/api/v1/users/${id}`);
}
