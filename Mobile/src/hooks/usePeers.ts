import { useMeshDrop } from '../context/MeshDropContext';

export function usePeers() {
  const {
    peers,
    connectedPeers,
    isLoadingPeers,
    peersError,
    refreshPeers,
    connectPeer,
    disconnectPeer,
  } = useMeshDrop();

  return {
    peers,
    connectedPeers,
    isLoading: isLoadingPeers,
    error: peersError,
    lastUpdated: null,
    refresh: refreshPeers,
    connectPeer,
    disconnectPeer,
  };
}
