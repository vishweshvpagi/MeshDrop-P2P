import { useCallback } from 'react';
import { useMeshDrop } from '../context/MeshDropContext';
import { transfersApi } from '../api/transfers';

export function useTransfers() {
  const {
    transfers,
    activeTransfers,
    pendingIncomingTransfers,
    completedTransfers,
    terminalTransfers,
    isLoadingTransfers,
    transfersError,
    refreshTransfers,
    acceptTransfer,
    rejectTransfer,
    cancelTransfer,
    resumeTransfer,
    deleteTransfer,
  } = useMeshDrop();

  const hasActive = activeTransfers.length > 0;

  const uploadAndSend = useCallback(
    async (peerId: string, fileUri: string, fileName: string, mimeType?: string) => {
      const res = await transfersApi.uploadAndStartTransfer(peerId, fileUri, fileName, mimeType);
      await refreshTransfers();
      return res;
    },
    [refreshTransfers]
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
    isLoading: isLoadingTransfers,
    error: transfersError,
    lastUpdated: null,
    refresh: refreshTransfers,
    uploadAndSend,
    acceptTransfer,
    rejectTransfer,
    cancelTransfer,
    resumeTransfer,
    deleteTransfer,
    downloadFile,
  };
}
