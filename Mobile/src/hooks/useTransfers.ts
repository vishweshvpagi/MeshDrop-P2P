import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { transfersApi } from '../api/transfers';
import { Transfer } from '../types/transfer';

export function useTransfers(pollIntervalMs: number = 1500) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isMounted = useRef(true);

  const fetchTransfers = useCallback(async (isInitial: boolean = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const data = await transfersApi.getTransfers();
      if (!isMounted.current) return;
      setTransfers(Array.isArray(data) ? data : []);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err.message || 'Failed to fetch transfers');
    } finally {
      if (isMounted.current && isInitial) {
        setIsLoading(false);
      }
    }
  }, []);

  // Adaptive polling interval: faster (1.5s) if active transfers exist, slower (4s) if idle
  const hasActive = useMemo(() => {
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
    isMounted.current = true;
    fetchTransfers(true);

    const interval = hasActive ? pollIntervalMs : 4000;
    const timer = setInterval(() => {
      fetchTransfers(false);
    }, interval);

    return () => {
      isMounted.current = false;
      clearInterval(timer);
    };
  }, [fetchTransfers, pollIntervalMs, hasActive]);

  // Split transfers into meaningful categories
  const activeTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const s = t.state;
      return (
        s === 'TRANSFERRING' ||
        s === 'OFFERING' ||
        s === 'ACCEPTED' ||
        s === 'VERIFYING' ||
        s === 'RESUMING' ||
        (s === 'WAITING_FOR_ACCEPT' && t.direction === 'OUTGOING')
      );
    });
  }, [transfers]);

  const pendingIncomingTransfers = useMemo(() => {
    return transfers.filter((t) => {
      return (
        (t.direction === 'INCOMING' || (t as any).direction === 'DOWNLOAD') &&
        t.state === 'WAITING_FOR_ACCEPT'
      );
    });
  }, [transfers]);

  const completedTransfers = useMemo(() => {
    return transfers.filter((t) => t.state === 'COMPLETED');
  }, [transfers]);

  const terminalTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const s = t.state;
      return (
        s === 'FAILED' ||
        s === 'CANCELLED' ||
        s === 'TIMED_OUT' ||
        s === 'REJECTED' ||
        s === 'INTERRUPTED' ||
        s === 'RESUMABLE'
      );
    });
  }, [transfers]);

  // Transfer actions
  const uploadAndSend = useCallback(
    async (peerId: string, fileUri: string, fileName: string, mimeType?: string) => {
      const res = await transfersApi.uploadAndStartTransfer(peerId, fileUri, fileName, mimeType);
      await fetchTransfers();
      return res;
    },
    [fetchTransfers]
  );

  const accept = useCallback(
    async (transferId: string) => {
      const res = await transfersApi.acceptTransfer(transferId);
      await fetchTransfers();
      return res;
    },
    [fetchTransfers]
  );

  const reject = useCallback(
    async (transferId: string, reason?: string) => {
      const res = await transfersApi.rejectTransfer(transferId, reason);
      await fetchTransfers();
      return res;
    },
    [fetchTransfers]
  );

  const cancel = useCallback(
    async (transferId: string) => {
      const res = await transfersApi.cancelTransfer(transferId);
      await fetchTransfers();
      return res;
    },
    [fetchTransfers]
  );

  const resume = useCallback(
    async (transferId: string) => {
      const res = await transfersApi.resumeTransfer(transferId);
      await fetchTransfers();
      return res;
    },
    [fetchTransfers]
  );

  const remove = useCallback(
    async (transferId: string) => {
      const res = await transfersApi.deleteTransfer(transferId);
      await fetchTransfers();
      return res;
    },
    [fetchTransfers]
  );

  const downloadFile = useCallback(
    async (transferId: string, fileName: string, onProgress?: (fraction: number) => void) => {
      return transfersApi.downloadTransferFile(transferId, fileName, onProgress);
    },
    []
  );

  return {
    transfers,
    activeTransfers,
    pendingIncomingTransfers,
    completedTransfers,
    terminalTransfers,
    hasActive,
    isLoading,
    error,
    lastUpdated,
    refresh: () => fetchTransfers(false),
    uploadAndSend,
    acceptTransfer: accept,
    rejectTransfer: reject,
    cancelTransfer: cancel,
    resumeTransfer: resume,
    deleteTransfer: remove,
    downloadFile,
  };
}
