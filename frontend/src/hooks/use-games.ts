'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────

export type GameProvider = {
  id: number;
  name: string;
  code: string;
  category: string;
  api_url: string | null;
  api_key: string | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Game = {
  id: number;
  provider_id: number;
  name: string;
  code: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  thumbnail_url: string | null;
  provider_name: string | null;
  created_at: string;
  updated_at: string;
};

export type GameRound = {
  id: number;
  game_id: number;
  user_id: number;
  round_id: string;
  bet_amount: number;
  win_amount: number;
  result: string;
  game_name: string | null;
  user_username: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

type ProviderListResponse = {
  items: GameProvider[];
  total: number;
  page: number;
  page_size: number;
};

type GameListResponse = {
  items: Game[];
  total: number;
  page: number;
  page_size: number;
};

type GameRoundListResponse = {
  items: GameRound[];
  total: number;
  page: number;
  page_size: number;
};

type ProviderFilters = {
  page?: number;
  page_size?: number;
  category?: string;
  search?: string;
  is_active?: boolean;
};

type GameFilters = {
  page?: number;
  page_size?: number;
  category?: string;
  provider_id?: number;
  search?: string;
  is_active?: boolean;
};

type GameRoundFilters = {
  page?: number;
  page_size?: number;
  game_id?: number;
  user_id?: number;
  result?: string;
};

// ─── Provider Hooks ──────────────────────────────────────────────

export function useProviderList(filters: ProviderFilters = {}) {
  const [data, setData] = useState<ProviderListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.category) params.set('category', filters.category);
      if (filters.search) params.set('search', filters.search);
      if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));
      const qs = params.toString();
      const result = await apiClient.get<ProviderListResponse>(
        `/api/v1/games/providers${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.category, filters.search, filters.is_active]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useProvider(id: number | null) {
  const [data, setData] = useState<GameProvider | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get<GameProvider>(`/api/v1/games/providers/${id}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}

// ─── Game Hooks ──────────────────────────────────────────────────

export function useGameList(filters: GameFilters = {}) {
  const [data, setData] = useState<GameListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.category) params.set('category', filters.category);
      if (filters.provider_id) params.set('provider_id', String(filters.provider_id));
      if (filters.search) params.set('search', filters.search);
      if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));
      const qs = params.toString();
      const result = await apiClient.get<GameListResponse>(
        `/api/v1/games${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.category, filters.provider_id, filters.search, filters.is_active]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useGame(id: number | null) {
  const [data, setData] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get<Game>(`/api/v1/games/${id}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}

// ─── Game Round Hooks ────────────────────────────────────────────

export function useGameRoundList(filters: GameRoundFilters = {}) {
  const [data, setData] = useState<GameRoundListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.page_size) params.set('page_size', String(filters.page_size));
      if (filters.game_id) params.set('game_id', String(filters.game_id));
      if (filters.user_id) params.set('user_id', String(filters.user_id));
      if (filters.result) params.set('result', filters.result);
      const qs = params.toString();
      const result = await apiClient.get<GameRoundListResponse>(
        `/api/v1/games/rounds${qs ? `?${qs}` : ''}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game rounds');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.page_size, filters.game_id, filters.user_id, filters.result]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Mutations ───────────────────────────────────────────────────

export async function createProvider(body: Record<string, unknown>) {
  return apiClient.post<GameProvider>('/api/v1/games/providers', body);
}

export async function updateProvider(id: number, body: Record<string, unknown>) {
  return apiClient.put<GameProvider>(`/api/v1/games/providers/${id}`, body);
}

export async function deleteProvider(id: number) {
  return apiClient.delete(`/api/v1/games/providers/${id}`);
}

export async function createGame(body: Record<string, unknown>) {
  return apiClient.post<Game>('/api/v1/games', body);
}

export async function updateGame(id: number, body: Record<string, unknown>) {
  return apiClient.put<Game>(`/api/v1/games/${id}`, body);
}

export async function deleteGame(id: number) {
  return apiClient.delete(`/api/v1/games/${id}`);
}
