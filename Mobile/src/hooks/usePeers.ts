import { useState, useEffect, useCallback, useRef } from 'react';
import { peersApi } from '../api/peers';
import { Peer } from '../types/peer';

export function usePeers(pollIntervalMs: number = 3000) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isMounted = useRef(true);

  const fetchPeers = useCallback(async (isInitial: boolean = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const data = await peersApi.getPeers();
      if (!isMounted.current) return;
      setPeers(Array.isArray(data) ? data : []);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (!isMounted.current) return;
      // Only surface error if we don't already have peers or if initial
      setError(err.message || 'Failed to fetch peers');
    } finally {
      if (isMounted.current && isInitial) {
        setIsLoading(false);
      }
    }
  }, []);

  const connect = useCallback(
    async (peerId: string): Promise<boolean> => {
      try {
        const res = await peersApi.connectPeer(peerId);
        await fetchPeers();
        return res.success;
      } catch (err: any) {
        setError(err.message || 'Failed to connect to peer');
        return false;
      }
    },
    [fetchPeers]
  );

  const disconnect = useCallback(
    async (peerId: string): Promise<boolean> => {
      try {
        const res = await peersApi.disconnectPeer(peerId);
        await fetchPeers();
        return res.success;
      } catch (err: any) {
        setError(err.message || 'Failed to disconnect peer');
        return false;
      }
    },
    [fetchPeers]
  );

  useEffect(() => {
    isMounted.current = true;
    fetchPeers(true);

    const timer = setInterval(() => {
      fetchPeers(false);
    }, pollIntervalMs);

    return () => {
      isMounted.current = false;
      clearInterval(timer);
    };
  }, [fetchPeers, pollIntervalMs]);

  const connectedPeers = peers.filter((p) => p.connected || p.state === 'CONNECTED');

  return {
    peers,
    connectedPeers,
    isLoading,
    error,
    lastUpdated,
    refresh: () => fetchPeers(false),
    connectPeer: connect,
    disconnectPeer: disconnect,
  };
}
