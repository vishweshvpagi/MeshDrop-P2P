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
    // 1. Inspect source file before upload
    console.log('[UPLOAD] source URI:', fileUri);
    console.log('[UPLOAD] source name:', fileName);

    let sourceExists = true;
    let sourceSize = 0;
    try {
      const sourceInfo = await FileSystem.getInfoAsync(fileUri);
      sourceExists = sourceInfo.exists;
      if (sourceInfo.exists && 'size' in sourceInfo && typeof sourceInfo.size === 'number') {
        sourceSize = sourceInfo.size;
      }
    } catch (infoErr) {
      console.warn('[UPLOAD] Could not get info on source URI:', infoErr);
    }

    console.log('[UPLOAD] source exists:', sourceExists);
    console.log('[UPLOAD] source readable:', sourceExists);
    console.log('[UPLOAD] source size:', sourceSize || 'unknown');

    // 2. Storage space verification
    try {
      if (typeof FileSystem.getFreeDiskStorageAsync === 'function') {
        const freeBytes = await FileSystem.getFreeDiskStorageAsync();
        console.log('[UPLOAD] Free device storage:', freeBytes);
        if (sourceSize > 0 && freeBytes < sourceSize + 50 * 1024 * 1024) {
          throw new Error(
            `Insufficient device storage to stage upload: ${Math.round(freeBytes / (1024 * 1024))} MB free, but ${Math.round(sourceSize / (1024 * 1024))} MB required.`
          );
        }
      }
    } catch (storageErr: any) {
      if (storageErr.message?.includes('Insufficient device storage')) {
        throw storageErr;
      }
      console.warn('[UPLOAD] Could not check free disk storage:', storageErr);
    }

    // 3. Staging: If source URI is a content:// URI or outside app sandbox, stage it disk-to-disk
    let uploadTargetUri = fileUri;
    let stagingUri: string | null = null;

    const baseCacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    const isAlreadyInAppSandbox = Boolean(baseCacheDir && fileUri.startsWith(baseCacheDir));

    if (fileUri.startsWith('content://') || !isAlreadyInAppSandbox) {
      const safeName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
      const stagingDir = `${baseCacheDir}staging/`;

      try {
        const dirInfo = await FileSystem.getInfoAsync(stagingDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(stagingDir, { intermediates: true });
        }
      } catch (dirErr) {
        console.warn('[UPLOAD] Error ensuring staging directory:', dirErr);
      }

      stagingUri = `${stagingDir}${Date.now()}_${safeName}`;
      console.log('[UPLOAD] Staging file disk-to-disk to:', stagingUri);

      await FileSystem.copyAsync({
        from: fileUri,
        to: stagingUri,
      });

      const stagedInfo = await FileSystem.getInfoAsync(stagingUri);
      if (!stagedInfo.exists) {
        throw new Error(`Staged file could not be verified at: ${stagingUri}`);
      }
      uploadTargetUri = stagingUri;
      if ('size' in stagedInfo && typeof stagedInfo.size === 'number') {
        sourceSize = stagedInfo.size;
      }
    }

    // 4. Pre-upload inspection logs for the target file to be uploaded
    let targetExists = true;
    let targetSize = sourceSize;
    try {
      const targetInfo = await FileSystem.getInfoAsync(uploadTargetUri);
      targetExists = targetInfo.exists;
      if (targetInfo.exists && 'size' in targetInfo && typeof targetInfo.size === 'number') {
        targetSize = targetInfo.size;
      }
    } catch (targetInfoErr) {
      console.warn('[UPLOAD] Could not get info on upload target URI:', targetInfoErr);
    }

    console.log('[UPLOAD] URI:', uploadTargetUri);
    console.log('[UPLOAD] exists:', targetExists);
    console.log('[UPLOAD] readable:', targetExists);
    console.log('[UPLOAD] size:', targetSize || sourceSize);

    // 5. Construct URL safely using URLSearchParams
    const baseUrl = getBaseUrl();
    const queryParams = new URLSearchParams({
      peerId,
      fileName,
    });
    const uploadUrl = `${baseUrl}/api/transfers/upload?${queryParams.toString()}`;
    const encodedFileName = encodeURIComponent(fileName);

    console.log('[UPLOAD] endpoint:', uploadUrl);
    console.log('[UPLOAD] upload START');
    console.log('[UPLOAD] upload PROGRESS');

    try {
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, uploadTargetUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': mimeType || 'application/octet-stream',
          'X-Peer-Id': peerId,
          'X-File-Name': encodedFileName,
          'X-MeshDrop-Client': 'mobile',
        },
      });

      console.log('[UPLOAD] upload COMPLETE');

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
    } finally {
      // 6. Clean up staging file strictly AFTER upload completes or fails
      if (stagingUri) {
        try {
          await FileSystem.deleteAsync(stagingUri, { idempotent: true });
          console.log('[UPLOAD] Staging file cleaned up:', stagingUri);
        } catch (cleanupErr) {
          console.warn('[UPLOAD] Failed to clean up staging file:', cleanupErr);
        }
      }
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
   * Completes a transfer once file is fully received and written.
   */
  async completeTransfer(transferId: string): Promise<Transfer> {
    return apiClient.post<Transfer>(`/api/transfers/${encodeURIComponent(transferId)}/complete`);
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

  /**
   * Returns the direct HTTP download URL for a completed transfer file on the backend.
   */
  getDownloadUrl(transferId: string): string {
    const baseUrl = getBaseUrl();
    return `${baseUrl}/api/transfers/${encodeURIComponent(transferId)}/download`;
  },

  /**
   * Downloads a completed transfer file from the Java backend PC to Android device storage.
   */
  async downloadTransferFile(
    transferId: string,
    fileName: string,
    onProgress?: (progressFraction: number) => void
  ): Promise<string> {
    const downloadUrl = this.getDownloadUrl(transferId);
    const safeName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
    const targetDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    const targetUri = `${targetDir}${safeName}`;

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      targetUri,
      {
        headers: {
          'X-MeshDrop-Client': 'mobile',
        },
      },
      (downloadProgress) => {
        if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
          const frac = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress(Math.min(1.0, Math.max(0.0, frac)));
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      throw new Error('Failed to download file from backend PC');
    }

    try {
      await this.completeTransfer(transferId);
    } catch {}

    return result.uri;
  },
};
