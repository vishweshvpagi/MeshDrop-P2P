export type PeerState = 'CONNECTED' | 'DISCONNECTED';

export type TrustDecision = 'TRUSTED' | 'UNTRUSTED';

export interface Peer {
  id: string;
  displayName: string;
  address: string;
  port: number;
  state: PeerState | string;
  connected: boolean;
  lastSeen: string | null;
  connectedAt: string | null;
  fingerprint: string;
  trustDecision: TrustDecision | string;
}
