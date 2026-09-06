export type ApiErrorCode =
  | 'BACKEND_UNAVAILABLE'
  | 'TIMEOUT'
  | 'PEER_NOT_FOUND'
  | 'PEER_UNREACHABLE'
  | 'TRANSFER_NOT_FOUND'
  | 'TRANSFER_FAILED'
  | 'INVALID_REQUEST'
  | 'NOT_ALLOWED'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface ApiNormalizedError {
  message: string;
  code: ApiErrorCode;
  status: number;
  details?: unknown;
}

/**
 * Custom error thrown when the backend returns a non-2xx HTTP status.
 */
export class MeshDropApiError extends Error {
  public statusCode: number;
  public details?: unknown;
  public code: ApiErrorCode;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'MeshDropApiError';
    this.statusCode = statusCode;
    this.details = details;

    if (statusCode === 400) this.code = 'INVALID_REQUEST';
    else if (statusCode === 404) {
      if (message.toLowerCase().includes('peer')) this.code = 'PEER_NOT_FOUND';
      else if (message.toLowerCase().includes('transfer')) this.code = 'TRANSFER_NOT_FOUND';
      else this.code = 'INVALID_REQUEST';
    } else if (statusCode === 405) this.code = 'NOT_ALLOWED';
    else if (statusCode >= 500) this.code = 'SERVER_ERROR';
    else this.code = 'UNKNOWN_ERROR';
  }

  public toNormalized(): ApiNormalizedError {
    return {
      message: this.message,
      code: this.code,
      status: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Custom error thrown when the backend cannot be reached (offline, refused, timeout).
 */
export class NetworkError extends Error {
  public cause?: unknown;
  public code: ApiErrorCode;

  constructor(message: string = 'MeshDrop backend is unreachable', cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
    this.code = message.toLowerCase().includes('time') ? 'TIMEOUT' : 'BACKEND_UNAVAILABLE';
  }

  public toNormalized(): ApiNormalizedError {
    return {
      message: this.message,
      code: this.code,
      status: 0,
      details: this.cause,
    };
  }
}

/**
 * Normalizes any caught error into a predictable ApiNormalizedError object.
 */
export function normalizeError(err: unknown): ApiNormalizedError {
  if (err instanceof MeshDropApiError) {
    return err.toNormalized();
  }
  if (err instanceof NetworkError) {
    return err.toNormalized();
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    message,
    code: 'UNKNOWN_ERROR',
    status: 500,
  };
}

export interface ApiClientConfig {
  baseUrl?: string;
  timeoutMillis?: number;
}

export class ApiClient {
  private baseUrl: string;
  private timeoutMillis: number;

  constructor(config: ApiClientConfig = {}) {
    let resolvedUrl = config.baseUrl;
    if (!resolvedUrl && typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const apiParam = params.get('api') || params.get('apiUrl');
        const apiPort = params.get('apiPort');
        if (apiParam) {
          resolvedUrl = apiParam;
        } else if (apiPort) {
          const host = window.location.hostname || 'localhost';
          resolvedUrl = `http://${host}:${apiPort}`;
        } else {
          const stored = localStorage.getItem('meshdrop_api_url');
          if (stored) {
            resolvedUrl = stored;
          } else if (window.location.port && window.location.port !== '80' && window.location.port !== '443') {
            const portNum = parseInt(window.location.port, 10);
            if (!isNaN(portNum) && portNum >= 3000 && portNum < 3100) {
              const offset = portNum - 3000;
              const host = window.location.hostname || 'localhost';
              resolvedUrl = `http://${host}:${8080 + offset}`;
            }
          }
        }
      } catch {
        // Fallback safely
      }
    }
    this.baseUrl = resolvedUrl || (import.meta.env?.VITE_MESHDROP_API_URL as string) || 'http://localhost:8080';
    this.timeoutMillis = config.timeoutMillis || 8000;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getPort(): number {
    try {
      const u = new URL(this.baseUrl);
      return parseInt(u.port, 10) || 8080;
    } catch {
      return 8080;
    }
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('meshdrop_api_url', this.baseUrl);
        window.dispatchEvent(new CustomEvent('meshdrop-api-url-changed', { detail: this.baseUrl }));
      } catch {}
    }
  }

  /**
   * Dispatches an HTTP request with automatic JSON handling and timeout guards.
   */
  public async request<T>(path: string, options: RequestInit & { timeoutMillis?: number } = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timeout = options.timeoutMillis ?? this.timeoutMillis;
    const timer = setTimeout(() => controller.abort(), timeout);

    const headers = new Headers(options.headers || {});
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status} ${response.statusText}`;
        let details: unknown = null;
        try {
          const body = await response.json();
          details = body;
          if (body && typeof body === 'object' && 'error' in body) {
            errorMessage = String(body.error);
          }
        } catch {
          // ignore non-JSON response body
        }
        throw new MeshDropApiError(errorMessage, response.status, details);
      }

      if (response.status === 204) {
        return null as unknown as T;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof MeshDropApiError) {
        throw err;
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new NetworkError('Request timed out connecting to MeshDrop backend');
      }

      // Check for connection refused / failed to fetch
      throw new NetworkError('MeshDrop backend is unreachable', err);
    } finally {
      clearTimeout(timer);
    }
  }

  public get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  public post<T>(path: string, body?: unknown, timeoutMillis?: number): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      timeoutMillis,
    });
  }

  public delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
