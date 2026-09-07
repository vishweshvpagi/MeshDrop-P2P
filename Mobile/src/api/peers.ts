import { apiClient } from './client';
import { Peer } from '../types/peer';

export const peersApi = {
  /**
   * Fetches all discovered and connected peers from the backend.
   */
  async getPeers(): Promise<Peer[]> {
    return apiClient.get<Peer[]>('/api/peers');
  },

  /**
   * Fetches details for a single peer by ID.
   */
  async getPeer(peerId: string): Promise<Peer> {
    return apiClient.get<Peer>(`/api/peers/${encodeURIComponent(peerId)}`);
  },

  /**
   * Triggers the backend to initiate a direct TCP connection with a known peer.
   */
  async connectPeer(peerId: string): Promise<{ success: boolean; connectionId?: number; error?: string }> {
    return apiClient.post<{ success: boolean; connectionId?: number; error?: string }>(
      `/api/peers/${encodeURIComponent(peerId)}/connect`
    );
  },

  /**
   * Triggers the backend to disconnect an active TCP session with a peer.
   */
  async disconnectPeer(peerId: string): Promise<{ success: boolean; error?: string }> {
    return apiClient.post<{ success: boolean; error?: string }>(
      `/api/peers/${encodeURIComponent(peerId)}/disconnect`
    );
  },
};
