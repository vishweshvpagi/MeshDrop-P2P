import { getBaseUrl } from './config';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 8000
): Promise<T> {
  const baseUrl = getBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  console.log(`[MeshDrop] ${method} ${cleanEndpoint}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { rawText: text };
    }

    if (!response.ok) {
      const errorMsg =
        data?.error ||
        data?.message ||
        `Request failed with status ${response.status} (${response.statusText})`;
      console.log(`[MeshDrop] ${method} ${cleanEndpoint} HTTP ${response.status}: ${errorMsg}`);
      throw new ApiError(errorMsg, response.status, false);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    if (err.name === 'AbortError') {
      const msg = `Request timed out after ${timeoutMs / 1000}s. Check if backend PC is reachable.`;
      console.log(`[MeshDrop] ${method} ${cleanEndpoint} timed out`);
      throw new ApiError(msg, undefined, true);
    }

    let userFriendlyMsg = 'Network request failed. Ensure PC and Phone are on the same Wi-Fi network and port 8080 is reachable.';
    if (err.message && !err.message.includes('Network request failed')) {
      userFriendlyMsg = err.message;
    }

    console.log(`[MeshDrop] ${method} ${cleanEndpoint} error: ${userFriendlyMsg}`);
    throw new ApiError(userFriendlyMsg, undefined, true);
  }
}

export const apiClient = {
  get: <T = any>(endpoint: string, timeoutMs?: number) =>
    request<T>(endpoint, { method: 'GET' }, timeoutMs),

  post: <T = any>(endpoint: string, body?: any, timeoutMs?: number) =>
    request<T>(
      endpoint,
      {
        method: 'POST',
        body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      },
      timeoutMs
    ),

  delete: <T = any>(endpoint: string, timeoutMs?: number) =>
    request<T>(endpoint, { method: 'DELETE' }, timeoutMs),
};
