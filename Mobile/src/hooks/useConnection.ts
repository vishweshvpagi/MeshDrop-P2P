import { useMeshDrop } from '../context/MeshDropContext';

export function useConnection() {
  const {
    baseUrl,
    isConnected,
    latencyMs,
    nodeStatus,
    connectionError,
    isCheckingConnection,
    checkConnection,
    updateBaseUrl,
    resetBaseUrl,
  } = useMeshDrop();

  return {
    baseUrl,
    isConnected,
    latencyMs,
    nodeStatus,
    error: connectionError,
    isChecking: isCheckingConnection,
    checkConnection,
    updateBaseUrl,
    resetBaseUrl,
  };
}
