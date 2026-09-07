import * as FileSystem from 'expo-file-system/legacy';
import { apiClient, ApiError } from './client';
import { getBaseUrl } from './config';
import { Transfer } from '../types/transfer';

export const transfersApi = {
  /**
   * Fetches all transfers tracked by the backend engine.
   */
  async getTransfers(): Promise<Transfer[]> {
    return apiClient.get<Transfer[]>('/api/transfers');
  },

  /**
   * Fetches pending incoming transfers awaiting user acceptance.
   */
  async getPendingTransfers(): Promise<Transfer[]> {
    return apiClient.get<Transfer[]>('/api/transfers/pending');
  },

  /**
   * Fetches a single transfer by ID.
   */
  async getTransfer(transferId: string): Promise<Transfer> {
    return apiClient.get<Transfer>(`/api/transfers/${encodeURIComponent(transferId)}`);
  },

  /**
   * Streams a file from the mobile device to the Java backend using native HTTP streaming
   * (zero memory buffering, supporting multi-gigabyte files), then initiates P2P transfer.
   */
  async uploadAndStartTransfer(
    peerId: string,
    fileUri: string,
    fileName: string,
    mimeType: string = 'application/octet-stream'
  ): Promise<{ success: boolean; transferId?: string; fileName?: string; fileSize?: number; error?: string }> {
    const baseUrl = getBaseUrl();
    const encodedFileName = encodeURIComponent(fileName);
    const uploadUrl = `${baseUrl}/api/transfers/upload?peerId=${encodeURIComponent(peerId)}&fileName=${encodedFileName}`;

    try {
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': mimeType || 'application/octet-stream',
          'X-Peer-Id': peerId,
          'X-File-Name': encodedFileName,
        },
      });

      let data: any;
      try {
        data = uploadResult.body ? JSON.parse(uploadResult.body) : {};
      } catch {
        data = { raw: uploadResult.body };
      }

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        const errorMsg = data?.error || data?.message || `Upload failed with status ${uploadResult.status}`;
        throw new ApiError(errorMsg, uploadResult.status, false);
      }

      return data;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err.message || 'Failed to stream file to backend PC.', undefined, true);
    }
  },

  /**
   * Starts a transfer from a known disk path on the PC host.
   */
  async startTransferFromPath(
    peerId: string,
    filePath: string
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    return apiClient.post('/api/transfers', { peerId, filePath }, 30000);
  },

  /**
   * Accepts an incoming transfer offer.
   */
  async acceptTransfer(transferId: string): Promise<Transfer> {
    return apiClient.post<Transfer>(`/api/transfers/${encodeURIComponent(transferId)}/accept`);
  },

  /**
   * Rejects an incoming transfer offer with an optional reason.
   */
  async rejectTransfer(
    transferId: string,
    reason: string = 'Declined by mobile user'
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    return apiClient.post(`/api/transfers/${encodeURIComponent(transferId)}/reject`, { reason });
  },

  /**
   * Resumes an interrupted transfer from its saved checkpoint.
   */
  async resumeTransfer(
    transferId: string
  ): Promise<{ success: boolean; transferId?: string; state?: string; error?: string }> {
    return apiClient.post(`/api/transfers/${encodeURIComponent(transferId)}/resume`);
  },

  /**
   * Cancels an active or queued transfer.
   */
  async cancelTransfer(
    transferId: string
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    return apiClient.post(`/api/transfers/${encodeURIComponent(transferId)}/cancel`);
  },

  /**
   * Removes a terminal transfer from the history list.
   */
  async deleteTransfer(
    transferId: string
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    return apiClient.delete(`/api/transfers/${encodeURIComponent(transferId)}`);
  },
};
