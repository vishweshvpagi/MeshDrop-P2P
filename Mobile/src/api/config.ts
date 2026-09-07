import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ConnectionTestResult, NodeStatus } from '../types/api';

const STORAGE_KEY = '@meshdrop_api_base_url';

// Smart default: 10.0.2.2 for Android Emulator, localhost for iOS/web, 192.168.1.100 for general
const DEFAULT_URL = Platform.select({
  android: 'http://10.0.2.2:8080',
  default: 'http://127.0.0.1:8080',
});

let cachedBaseUrl: string = DEFAULT_URL;
let isInitialized = false;
const listeners: Array<(url: string) => void> = [];

export function subscribeBaseUrlChange(listener: (url: string) => void): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export async function initConfig(): Promise<string> {
  if (isInitialized) return cachedBaseUrl;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim().length > 0) {
      cachedBaseUrl = normalizeUrl(stored.trim());
    }
  } catch (err) {
    console.warn('[CONFIG] Failed to read stored backend URL:', err);
  }
  isInitialized = true;
  return cachedBaseUrl;
}

export function getBaseUrl(): string {
  return cachedBaseUrl;
}

export async function setBaseUrl(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  cachedBaseUrl = normalized;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, normalized);
  } catch (err) {
    console.warn('[CONFIG] Failed to persist backend URL:', err);
  }
  for (const listener of listeners) {
    try {
      listener(normalized);
    } catch {}
  }
  return normalized;
}

export function normalizeUrl(input: string): string {
  let cleaned = input.trim();
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `http://${cleaned}`;
  }
  while (cleaned.endsWith('/')) {
    cleaned = cleaned.substring(0, cleaned.length - 1);
  }
  return cleaned;
}

export function parseHostPort(url: string): { host: string; port: string } {
  try {
    const normalized = normalizeUrl(url);
    const withoutProto = normalized.replace(/^https?:\/\//, '');
    const parts = withoutProto.split(':');
    const host = parts[0] || '127.0.0.1';
    const port = parts[1] || '8080';
    return { host, port };
  } catch {
    return { host: '127.0.0.1', port: '8080' };
  }
}

/**
 * Tests connection to the backend and fetches NodeStatus.
 */
export async function testConnection(customUrl?: string): Promise<ConnectionTestResult> {
  const target = normalizeUrl(customUrl || cachedBaseUrl);
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${target}/api/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        connected: false,
        latencyMs,
        error: `Backend responded with HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const nodeStatus: NodeStatus = await response.json();
    return {
      connected: true,
      latencyMs,
      nodeStatus,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    let message = 'Unable to reach backend PC.';
    if (err.name === 'AbortError') {
      message = 'Connection timed out (no response within 6s). Check if backend is running.';
    } else if (err.message) {
      if (err.message.includes('Network request failed')) {
        message = 'Network request failed. Ensure phone and PC are on the same Wi-Fi and the IP is correct.';
      } else {
        message = err.message;
      }
    }
    return {
      connected: false,
      latencyMs,
      error: message,
    };
  }
}
