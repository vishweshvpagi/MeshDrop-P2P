import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  initConfig,
  getBaseUrl,
  setBaseUrl as persistBaseUrl,
  resetToDefaultUrl,
  testConnection,
  subscribeBaseUrlChange,
  validateBackendUrl,
} from '../api/config';
import { peersApi } from '../api/peers';
import { transfersApi } from '../api/transfers';
import { NodeStatus } from '../types/api';
import { Peer } from '../types/peer';
import { Transfer } from '../types/transfer';

interface MeshDropContextValue {
  // Connection state
  baseUrl: string;
  isConnected: boolean | null;
  latencyMs: number | null;
  nodeStatus: NodeStatus | null;
  connectionError: string | null;
  isCheckingConnection: boolean;
  checkConnection: (customUrl?: string) => Promise<boolean>;
  updateBaseUrl: (newUrl: string) => Promise<boolean>;
  resetBaseUrl: () => Promise<string>;

  // Peers state
  peers: Peer[];
  connectedPeers: Peer[];
  isLoadingPeers: boolean;
  peersError: string | null;
  refreshPeers: () => Promise<void>;
  connectPeer: (peerId: string) => Promise<boolean>;
  disconnectPeer: (peerId: string) => Promise<boolean>;

  // Transfers state
  transfers: Transfer[];
  activeTransfers: Transfer[];
  pendingIncomingTransfers: Transfer[];
  completedTransfers: Transfer[];
  terminalTransfers: Transfer[];
  isLoadingTransfers: boolean;
  transfersError: string | null;
  refreshTransfers: () => Promise<void>;
  acceptTransfer: (transferId: string) => Promise<void>;
  downloadTransfer: (
    transferId: string,
    fileName: string,
    onProgress?: (progressFraction: number) => void
  ) => Promise<string>;
  rejectTransfer: (transferId: string, reason?: string) => Promise<void>;
  cancelTransfer: (transferId: string) => Promise<void>;
  resumeTransfer: (transferId: string) => Promise<void>;
  deleteTransfer: (transferId: string) => Promise<void>;
}

const MeshDropContext = createContext<MeshDropContextValue | null>(null);

export const MeshDropProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Connection state
  const [baseUrl, setBaseUrlState] = useState<string>(getBaseUrl());
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  // Peers state
  const [peers, setPeers] = useState<Peer[]>([]);
  const [isLoadingPeers, setIsLoadingPeers] = useState<boolean>(false);
  const [peersError, setPeersError] = useState<string | null>(null);

  // Transfers state
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState<boolean>(false);
  const [transfersError, setTransfersError] = useState<string | null>(null);

  // Lifecycle & concurrency guards
  const isMounted = useRef(true);
  const isFetchingStatus = useRef(false);
  const isFetchingPeers = useRef(false);
  const isFetchingTransfers = useRef(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peersTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transfersTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // 1. Connection Healthcheck
  // ---------------------------------------------------------------------------
  const checkConnection = useCallback(async (customUrl?: string): Promise<boolean> => {
    if (isFetchingStatus.current) return isConnected ?? false;
    isFetchingStatus.current = true;
    setIsCheckingConnection(true);

    try {
      const result = await testConnection(customUrl);
      if (!isMounted.current) return false;

      setIsConnected(result.connected);
      setLatencyMs(result.latencyMs);

      if (result.connected && result.nodeStatus) {
        setNodeStatus(result.nodeStatus);
        setConnectionError(null);
        return true;
      } else {
        setNodeStatus(null);
        setConnectionError(result.error || 'Unable to connect to backend');
        return false;
      }
    } finally {
      isFetchingStatus.current = false;
      if (isMounted.current) {
        setIsCheckingConnection(false);
      }
    }
  }, [isConnected]);

  const updateBaseUrl = useCallback(
    async (newUrl: string): Promise<boolean> => {
      const validation = validateBackendUrl(newUrl);
      const targetUrl = validation.normalized || newUrl;
      const persisted = await persistBaseUrl(targetUrl);
      setBaseUrlState(persisted);
      return await checkConnection(persisted);
    },
    [checkConnection]
  );

  const resetBaseUrl = useCallback(async (): Promise<string> => {
    const defaultUrl = await resetToDefaultUrl();
    setBaseUrlState(defaultUrl);
    await checkConnection(defaultUrl);
    return defaultUrl;
  }, [checkConnection]);

  // ---------------------------------------------------------------------------
  // 2. Peers Fetching (with in-flight guard)
  // ---------------------------------------------------------------------------
  const fetchPeers = useCallback(async (isInitial: boolean = false) => {
    if (isFetchingPeers.current || !isMounted.current) return;
    if (!isConnected) return; // Do not poll when offline!

    isFetchingPeers.current = true;
    if (isInitial) setIsLoadingPeers(true);

    try {
      const data = await peersApi.getPeers();
      if (!isMounted.current) return;
      setPeers(Array.isArray(data) ? data : []);
      setPeersError(null);
    } catch (err: any) {
      if (!isMounted.current) return;
      setPeersError(err.message || 'Failed to fetch peers');
    } finally {
      isFetchingPeers.current = false;
      if (isMounted.current && isInitial) {
        setIsLoadingPeers(false);
      }
    }
  }, [isConnected]);

  const connectPeer = useCallback(
    async (peerId: string): Promise<boolean> => {
      try {
        const res = await peersApi.connectPeer(peerId);
        await fetchPeers(false);
        return res.success;
      } catch (err: any) {
        setPeersError(err.message || 'Failed to connect to peer');
        return false;
      }
    },
    [fetchPeers]
  );

  const disconnectPeer = useCallback(
    async (peerId: string): Promise<boolean> => {
      try {
        const res = await peersApi.disconnectPeer(peerId);
        await fetchPeers(false);
        return res.success;
      } catch (err: any) {
        setPeersError(err.message || 'Failed to disconnect peer');
        return false;
      }
    },
    [fetchPeers]
  );

  // ---------------------------------------------------------------------------
  // 3. Transfers Fetching (with in-flight guard)
  // ---------------------------------------------------------------------------
  const fetchTransfers = useCallback(async (isInitial: boolean = false) => {
    if (isFetchingTransfers.current || !isMounted.current) return;
    if (!isConnected) return; // Do not poll when offline!

    isFetchingTransfers.current = true;
    if (isInitial) setIsLoadingTransfers(true);

    try {
      const data = await transfersApi.getTransfers();
      if (!isMounted.current) return;
      setTransfers(Array.isArray(data) ? data : []);
      setTransfersError(null);
    } catch (err: any) {
      if (!isMounted.current) return;
      setTransfersError(err.message || 'Failed to fetch transfers');
    } finally {
      isFetchingTransfers.current = false;
      if (isMounted.current && isInitial) {
        setIsLoadingTransfers(false);
      }
    }
  }, [isConnected]);

  const acceptTransfer = useCallback(
    async (transferId: string) => {
      try {
        await transfersApi.acceptTransfer(transferId);
        await fetchTransfers(false);
      } catch (err: any) {
        setTransfersError(err.message || 'Failed to accept transfer');
      }
    },
    [fetchTransfers]
  );

  const downloadTransfer = useCallback(
    async (
      transferId: string,
      fileName: string,
      onProgress?: (progressFraction: number) => void
    ): Promise<string> => {
      try {
        const uri = await transfersApi.downloadTransferFile(transferId, fileName, onProgress);
        await fetchTransfers(false);
        return uri;
      } catch (err: any) {
        setTransfersError(err.message || 'Failed to download transfer');
        throw err;
      }
    },
    [fetchTransfers]
  );

  const rejectTransfer = useCallback(
    async (transferId: string, reason?: string) => {
      try {
        await transfersApi.rejectTransfer(transferId, reason);
        await fetchTransfers(false);
      } catch (err: any) {
        setTransfersError(err.message || 'Failed to reject transfer');
      }
    },
    [fetchTransfers]
  );

  const cancelTransfer = useCallback(
    async (transferId: string) => {
      try {
        await transfersApi.cancelTransfer(transferId);
        await fetchTransfers(false);
      } catch (err: any) {
        setTransfersError(err.message || 'Failed to cancel transfer');
      }
    },
    [fetchTransfers]
  );

  const resumeTransfer = useCallback(
    async (transferId: string) => {
      try {
        await transfersApi.resumeTransfer(transferId);
        await fetchTransfers(false);
      } catch (err: any) {
        setTransfersError(err.message || 'Failed to resume transfer');
      }
    },
    [fetchTransfers]
  );

  const deleteTransfer = useCallback(
    async (transferId: string) => {
      try {
        await transfersApi.deleteTransfer(transferId);
        await fetchTransfers(false);
      } catch (err: any) {
        setTransfersError(err.message || 'Failed to delete transfer');
      }
    },
    [fetchTransfers]
  );

  // ---------------------------------------------------------------------------
  // 4. Lifecycle & Sequential Polling Loops (Scheduled AFTER request completes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    isMounted.current = true;

    // Load initial config and run first health check
    initConfig().then((initial) => {
      if (isMounted.current) {
        setBaseUrlState(initial);
        checkConnection(initial);
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
      if (statusTimer.current) clearTimeout(statusTimer.current);
      if (peersTimer.current) clearTimeout(peersTimer.current);
      if (transfersTimer.current) clearTimeout(transfersTimer.current);
    };
  }, [checkConnection]);

  // Connection Heartbeat Loop (Gentle, sequential, non-overlapping)
  useEffect(() => {
    let active = true;

    const scheduleNextStatus = (delayMs: number) => {
      if (!active) return;
      if (statusTimer.current) clearTimeout(statusTimer.current);
      statusTimer.current = setTimeout(async () => {
        if (!active) return;
        await checkConnection();
        // Schedule next only AFTER previous has finished
        scheduleNextStatus(isConnected ? 10000 : 12000);
      }, delayMs);
    };

    scheduleNextStatus(10000);

    return () => {
      active = false;
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, [checkConnection, isConnected]);

  // Peers Sequential Polling Loop (Only when connected!)
  useEffect(() => {
    if (!isConnected) {
      if (peersTimer.current) clearTimeout(peersTimer.current);
      return;
    }

    let active = true;

    const scheduleNextPeers = (delayMs: number) => {
      if (!active) return;
      if (peersTimer.current) clearTimeout(peersTimer.current);
      peersTimer.current = setTimeout(async () => {
        if (!active || !isConnected) return;
        await fetchPeers(false);
        scheduleNextPeers(4000);
      }, delayMs);
    };

    fetchPeers(true);
    scheduleNextPeers(4000);

    return () => {
      active = false;
      if (peersTimer.current) clearTimeout(peersTimer.current);
    };
  }, [isConnected, fetchPeers]);

  // Transfers Sequential Polling Loop (Only when connected!)
  const hasActiveTransfers = useMemo(() => {
    return transfers.some((t) => {
      const s = t.state;
      return (
        s === 'TRANSFERRING' ||
        s === 'OFFERING' ||
        s === 'WAITING_FOR_ACCEPT' ||
        s === 'ACCEPTED' ||
        s === 'VERIFYING' ||
        s === 'RESUMING'
      );
    });
  }, [transfers]);

  useEffect(() => {
    if (!isConnected) {
      if (transfersTimer.current) clearTimeout(transfersTimer.current);
      return;
    }

    let active = true;

    const scheduleNextTransfers = (delayMs: number) => {
      if (!active) return;
      if (transfersTimer.current) clearTimeout(transfersTimer.current);
      transfersTimer.current = setTimeout(async () => {
        if (!active || !isConnected) return;
        await fetchTransfers(false);
        scheduleNextTransfers(hasActiveTransfers ? 1500 : 5000);
      }, delayMs);
    };

    fetchTransfers(true);
    scheduleNextTransfers(hasActiveTransfers ? 1500 : 5000);

    return () => {
      active = false;
      if (transfersTimer.current) clearTimeout(transfersTimer.current);
    };
  }, [isConnected, fetchTransfers, hasActiveTransfers]);

  // ---------------------------------------------------------------------------
  // 5. Memoized Derived Collections
  // ---------------------------------------------------------------------------
  const displayPeers = useMemo(() => {
    if (!isConnected) return peers;
    let hostAddress = '127.0.0.1';
    try {
      const match = baseUrl.match(/:\/\/([^:/]+)/);
      if (match) hostAddress = match[1];
    } catch {}

    const hostPeer: Peer = {
      id: 'local',
      displayName: nodeStatus?.displayName ? `${nodeStatus.displayName} (This PC)` : 'My PC (Host)',
      address: hostAddress,
      port: 8080,
      connected: true,
      state: 'CONNECTED',
      discoveredAt: Date.now(),
      lastSeen: Date.now(),
    } as any;

    const filtered = peers.filter(
      (p) => p.id !== 'local' && p.id !== '00000000-0000-0000-0000-000000000001'
    );
    return [hostPeer, ...filtered];
  }, [isConnected, peers, nodeStatus, baseUrl]);

  const connectedPeers = useMemo(
    () => displayPeers.filter((p) => p.connected || p.state === 'CONNECTED'),
    [displayPeers]
  );

  const activeTransfers = useMemo(
    () =>
      transfers.filter((t) => {
        const s = t.state;
        return (
          s === 'TRANSFERRING' ||
          s === 'OFFERING' ||
          s === 'ACCEPTED' ||
          s === 'VERIFYING' ||
          s === 'RESUMING' ||
          (s === 'WAITING_FOR_ACCEPT' && t.direction === 'OUTGOING' && !(t as any).isMobileTarget)
        );
      }),
    [transfers]
  );

  const pendingIncomingTransfers = useMemo(
    () =>
      transfers.filter(
        (t) =>
          ((t.direction === 'INCOMING' || (t as any).direction === 'DOWNLOAD') ||
            (t as any).isMobileTarget === true ||
            (t as any).recipient === 'MOBILE') &&
          t.state === 'WAITING_FOR_ACCEPT'
      ),
    [transfers]
  );

  const completedTransfers = useMemo(
    () => transfers.filter((t) => t.state === 'COMPLETED'),
    [transfers]
  );

  const terminalTransfers = useMemo(
    () =>
      transfers.filter((t) => {
        const s = t.state;
        return (
          s === 'FAILED' ||
          s === 'CANCELLED' ||
          s === 'TIMED_OUT' ||
          s === 'REJECTED' ||
          s === 'INTERRUPTED' ||
          s === 'RESUMABLE'
        );
      }),
    [transfers]
  );

  const value = useMemo(
    (): MeshDropContextValue => ({
      baseUrl,
      isConnected,
      latencyMs,
      nodeStatus,
      connectionError,
      isCheckingConnection,
      checkConnection,
      updateBaseUrl,
      resetBaseUrl,

      peers: displayPeers,
      connectedPeers,
      isLoadingPeers,
      peersError,
      refreshPeers: () => fetchPeers(false),
      connectPeer,
      disconnectPeer,

      transfers,
      activeTransfers,
      pendingIncomingTransfers,
      completedTransfers,
      terminalTransfers,
      isLoadingTransfers,
      transfersError,
      refreshTransfers: () => fetchTransfers(false),
      acceptTransfer,
      downloadTransfer,
      rejectTransfer,
      cancelTransfer,
      resumeTransfer,
      deleteTransfer,
    }),
    [
      baseUrl,
      isConnected,
      latencyMs,
      nodeStatus,
      connectionError,
      isCheckingConnection,
      checkConnection,
      updateBaseUrl,
      resetBaseUrl,
      displayPeers,
      connectedPeers,
      isLoadingPeers,
      peersError,
      fetchPeers,
      connectPeer,
      disconnectPeer,
      transfers,
      activeTransfers,
      pendingIncomingTransfers,
      completedTransfers,
      terminalTransfers,
      isLoadingTransfers,
      transfersError,
      fetchTransfers,
      acceptTransfer,
      downloadTransfer,
      rejectTransfer,
      cancelTransfer,
      resumeTransfer,
      deleteTransfer,
    ]
  );

  return <MeshDropContext.Provider value={value}>{children}</MeshDropContext.Provider>;
};

export function useMeshDrop(): MeshDropContextValue {
  const context = useContext(MeshDropContext);
  if (!context) {
    throw new Error('useMeshDrop must be used within a MeshDropProvider');
  }
  return context;
}
