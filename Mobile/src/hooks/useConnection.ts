import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initConfig,
  getBaseUrl,
  setBaseUrl,
  testConnection,
  subscribeBaseUrlChange,
  resetToDefaultUrl,
} from '../api/config';
import { NodeStatus } from '../types/api';

export function useConnection(autoCheckIntervalMs: number = 10000) {
  const [baseUrl, setBaseUrlState] = useState<string>(getBaseUrl());
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const isMounted = useRef(true);

  const check = useCallback(async (customUrl?: string) => {
    setIsChecking(true);
    const result = await testConnection(customUrl);
    if (!isMounted.current) return;

    setIsConnected(result.connected);
    setLatencyMs(result.latencyMs);
    if (result.connected && result.nodeStatus) {
      setNodeStatus(result.nodeStatus);
      setError(null);
    } else {
      setNodeStatus(null);
      setError(result.error || 'Connection failed');
    }
    setIsChecking(false);
  }, []);

  const changeUrl = useCallback(
    async (newUrl: string) => {
      const updated = await setBaseUrl(newUrl);
      setBaseUrlState(updated);
      await check(updated);
    },
    [check]
  );

  const resetUrl = useCallback(async () => {
    const updated = await resetToDefaultUrl();
    setBaseUrlState(updated);
    await check(updated);
    return updated;
  }, [check]);

  useEffect(() => {
    isMounted.current = true;
    initConfig().then((initial) => {
      if (isMounted.current) {
        setBaseUrlState(initial);
        check(initial);
      }
    });

    const unsubscribe = subscribeBaseUrlChange((newUrl) => {
      if (isMounted.current) {
        setBaseUrlState(newUrl);
      }
    });

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [check]);

  // Periodic heartbeat / connectivity check
  useEffect(() => {
    if (autoCheckIntervalMs <= 0) return;
    const timer = setInterval(() => {
      check();
    }, autoCheckIntervalMs);
    return () => clearInterval(timer);
  }, [check, autoCheckIntervalMs]);

  return {
    baseUrl,
    isConnected,
    latencyMs,
    nodeStatus,
    error,
    isChecking,
    checkConnection: check,
    updateBaseUrl: changeUrl,
    resetBaseUrl: resetUrl,
  };
}
