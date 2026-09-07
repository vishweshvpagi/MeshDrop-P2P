export interface NodeStatus {
  nodeId: string;
  displayName: string;
  running: boolean;
  state: string;
  tcpPort: number;
  discoveryPort: number;
  discoveryRunning: boolean;
  fingerprint: string;
  uptimeMillis: number;
  connectionCount: number;
  peerCount: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ConnectionConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https';
}

export interface ConnectionTestResult {
  connected: boolean;
  latencyMs: number;
  nodeStatus?: NodeStatus;
  error?: string;
}
