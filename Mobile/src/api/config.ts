import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ConnectionTestResult, NodeStatus } from '../types/api';

const STORAGE_KEY = '@meshdrop_api_base_url';

/**
 * Dynamically detects a sensible default backend URL without defaulting to localhost on Android.
 * Priority:
 * 1. Environment variable EXPO_PUBLIC_BACKEND_URL (set by start-meshdrop.ps1)
 * 2. Metro Bundler hostUri (auto-detects the laptop IP serving the bundle over Wi-Fi)
 * 3. Platform fallback (template LAN IP for Android, localhost for Web/Desktop)
 */
export function detectDefaultHost(): string {
  // 1. Check EXPO_PUBLIC_BACKEND_URL
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return normalizeUrl(envUrl.trim());
  }

  // 2. Check Expo hostUri (IP of the machine running Metro bundler)
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:8080`;
    }
  }

  // 3. Fallback: NEVER default to 127.0.0.1 on physical Android!
  if (Platform.OS === 'android') {
    return 'http://192.168.1.100:8080';
  }

  return 'http://localhost:8080';
}

let cachedBaseUrl: string = detectDefaultHost();
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
  const defaultUrl = detectDefaultHost();
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim().length > 0) {
      cachedBaseUrl = normalizeUrl(stored.trim());
    } else {
      cachedBaseUrl = defaultUrl;
    }
  } catch (err) {
    console.warn('[MeshDrop] Failed to read stored backend URL:', err);
    cachedBaseUrl = defaultUrl;
  }
  isInitialized = true;
  console.log(`[MeshDrop] Backend URL: ${cachedBaseUrl}`);
  return cachedBaseUrl;
}

export function getBaseUrl(): string {
  return cachedBaseUrl;
}

export async function setBaseUrl(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  cachedBaseUrl = normalized;
  console.log(`[MeshDrop] Backend URL: ${normalized}`);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, normalized);
  } catch (err) {
    console.warn('[MeshDrop] Failed to persist backend URL:', err);
  }
  for (const listener of listeners) {
    try {
      listener(normalized);
    } catch {}
  }
  return normalized;
}

export async function resetToDefaultUrl(): Promise<string> {
  const defaultUrl = detectDefaultHost();
  cachedBaseUrl = defaultUrl;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[MeshDrop] Failed to clear stored backend URL:', err);
  }
  console.log(`[MeshDrop] Reset Backend URL to: ${defaultUrl}`);
  for (const listener of listeners) {
    try {
      listener(defaultUrl);
    } catch {}
  }
  return defaultUrl;
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
    const host = parts[0] || '192.168.1.100';
    const port = parts[1] || '8080';
    return { host, port };
  } catch {
    return { host: '192.168.1.100', port: '8080' };
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

  console.log(`[MeshDrop] GET ${target}/api/status`);

  try {
    const response = await fetch(`${target}/api/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorMsg = `Backend responded with HTTP ${response.status}: ${response.statusText}`;
      console.log(`[MeshDrop] Connection failed: ${errorMsg}`);
      return {
        connected: false,
        latencyMs,
        error: errorMsg,
      };
    }

    const nodeStatus: NodeStatus = await response.json();
    console.log(`[MeshDrop] Connected (${nodeStatus.displayName || 'Node'}) - ${latencyMs}ms`);
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
      message = 'Connection timed out (no response within 6s). Check if backend is running on your PC.';
    } else if (Platform.OS === 'android' && (target.includes('127.0.0.1') || target.includes('localhost'))) {
      message =
        "On Android, '127.0.0.1' and 'localhost' point to your phone itself, NOT your PC! Enter your laptop's Wi-Fi IP (e.g. http://192.168.x.x:8080) shown in start-meshdrop.ps1.";
    } else if (err.message) {
      if (err.message.includes('Network request failed') || err.message.includes('ConnectException')) {
        message =
          'Network request failed. Ensure your phone and laptop are connected to the same Wi-Fi network and port 8080 is reachable.';
      } else {
        message = err.message;
      }
    }
    console.log(`[MeshDrop] Connection failed: ${message}`);
    return {
      connected: false,
      latencyMs,
      error: message,
    };
  }
}
