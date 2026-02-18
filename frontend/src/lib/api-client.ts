export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002';

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.refreshToken ?? null;
  } catch {
    return null;
  }
}

async function tryRefresh(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Update store directly in localStorage
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.state.accessToken = data.access_token;
      parsed.state.refreshToken = data.refresh_token;
      localStorage.setItem('auth-storage', JSON.stringify(parsed));
    }
    return data.access_token;
  } catch {
    return null;
  }
}

async function fetchApi<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body } = options;

  const token = getToken();
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  // Auto-refresh on 401
  if (response.status === 401 && token) {
    const newToken = await tryRefresh();
    if (newToken) {
      config.headers = {
        ...config.headers as Record<string, string>,
        'Authorization': `Bearer ${newToken}`,
      };
      response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    const err = new Error(error.detail || `HTTP ${response.status}`) as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const apiClient = {
  get: <T>(endpoint: string, headers?: Record<string, string>) =>
    fetchApi<T>(endpoint, { headers }),
  post: <T>(endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    fetchApi<T>(endpoint, { method: 'POST', body, headers }),
  put: <T>(endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    fetchApi<T>(endpoint, { method: 'PUT', body, headers }),
  delete: <T>(endpoint: string, headers?: Record<string, string>) =>
    fetchApi<T>(endpoint, { method: 'DELETE', headers }),
};
