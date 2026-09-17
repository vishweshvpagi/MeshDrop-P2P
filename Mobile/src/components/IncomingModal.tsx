import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { Transfer } from '../types/transfer';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { formatBytes } from '../utils/formatters';
import { transfersApi } from '../api/transfers';

interface IncomingModalProps {
  transfer: Transfer | null;
  onAccept: (transferId: string) => Promise<any>;
  onReject: (transferId: string, reason?: string) => Promise<any>;
  onClose?: () => void;
}

export const IncomingModal: React.FC<IncomingModalProps> = ({
  transfer,
  onAccept,
  onReject,
  onClose,
}) => {
  const [activeTransfer, setActiveTransfer] = useState<Transfer | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedUri, setDownloadedUri] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (transfer && !activeTransfer) {
      setActiveTransfer(transfer);
      setIsCompleted(false);
      setDownloadedUri(null);
      setDownloadProgress(0);
      setIsDownloading(false);
      setErrorMessage(null);
    }
  }, [transfer, activeTransfer]);

  if (!activeTransfer) return null;

  const transferId = activeTransfer.transferId || activeTransfer.id;

  const handleClose = () => {
    setActiveTransfer(null);
    setIsCompleted(false);
    setDownloadedUri(null);
    setDownloadProgress(0);
    setIsDownloading(false);
    setErrorMessage(null);
    onClose?.();
  };

  const handleAccept = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await onAccept(transferId);
      setIsProcessing(false);
      setIsDownloading(true);
      setDownloadProgress(0);

      const uri = await transfersApi.downloadTransferFile(
        transferId,
        activeTransfer.fileName,
        (progressFraction) => {
          setDownloadProgress(Math.round(progressFraction * 100));
        }
      );

      setDownloadedUri(uri);
      setIsCompleted(true);
      setIsDownloading(false);
    } catch (err: any) {
      setIsProcessing(false);
      setIsDownloading(false);
      setErrorMessage(err.message || 'Failed to download file from PC');
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await onReject(transferId, 'User declined via mobile client');
      handleClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to decline transfer');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = async () => {
    if (!downloadedUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadedUri, {
          dialogTitle: `Open ${activeTransfer.fileName}`,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not open share dialog');
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={activeTransfer !== null}
      onRequestClose={isDownloading ? undefined : handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={[styles.iconCircle, isCompleted && styles.iconCircleSuccess]}>
            <Text style={styles.iconText}>
              {isCompleted ? '✅' : isDownloading ? '⚡' : '📥'}
            </Text>
          </View>

          <Text style={styles.title}>
            {isCompleted
              ? 'File Received Successfully!'
              : isDownloading
              ? 'Downloading from PC...'
              : 'Incoming File Transfer'}
          </Text>
          <Text style={styles.subtitle}>
            {isCompleted
              ? 'The file has been saved directly to your device storage'
              : isDownloading
              ? 'Streaming binary chunks over LAN directly to storage'
              : 'A remote peer wants to send you a file over MeshDrop'}
          </Text>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>File Name:</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {activeTransfer.fileName}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Size:</Text>
              <Text style={styles.detailValueBold}>{formatBytes(activeTransfer.fileSize)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sender:</Text>
              <Text style={styles.detailValue}>{activeTransfer.peerName || 'Host PC'}</Text>
            </View>

            {activeTransfer.sha256 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SHA-256:</Text>
                <Text style={styles.hashText} numberOfLines={1}>
                  {activeTransfer.sha256.substring(0, 16)}...
                </Text>
              </View>
            )}

            {isDownloading && (
              <View style={styles.downloadProgressSection}>
                <ProgressBar progress={downloadProgress} height={10} color="#2563eb" />
                <View style={styles.progressTextRow}>
                  <Text style={styles.progressPercent}>{downloadProgress}%</Text>
                  <Text style={styles.progressBytes}>
                    {formatBytes((activeTransfer.fileSize * downloadProgress) / 100)} /{' '}
                    {formatBytes(activeTransfer.fileSize)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {isCompleted ? (
            <View style={styles.buttonsContainer}>
              <Button
                title="Done"
                variant="outline"
                size="lg"
                onPress={handleClose}
                style={styles.buttonHalf}
              />
              <Button
                title="Open / Share File"
                variant="success"
                size="lg"
                onPress={handleShare}
                style={[styles.buttonHalf, styles.buttonAccept]}
              />
            </View>
          ) : isDownloading ? (
            <View style={styles.downloadingContainer}>
              <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 8 }} />
              <Text style={styles.downloadingText}>Streaming to storage ({downloadProgress}%)...</Text>
            </View>
          ) : (
            <View style={styles.buttonsContainer}>
              <Button
                title="Decline"
                variant="danger"
                size="lg"
                disabled={isProcessing}
                onPress={handleReject}
                style={styles.buttonHalf}
              />
              <Button
                title="Accept & Download"
                variant="success"
                size="lg"
                disabled={isProcessing}
                isLoading={isProcessing}
                onPress={handleAccept}
                style={[styles.buttonHalf, styles.buttonAccept]}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconCircleSuccess: {
    backgroundColor: '#dcfce7',
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    width: '100%',
    marginBottom: 14,
  },
  errorBannerText: {
    color: '#dc2626',
    fontSize: 12,
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    width: '100%',
    marginBottom: 20,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0f172a',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  detailValueBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  hashText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#94a3b8',
  },
  downloadProgressSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  progressBytes: {
    fontSize: 12,
    color: '#64748b',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  buttonHalf: {
    flex: 1,
  },
  buttonAccept: {
    flex: 1.4,
  },
  downloadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  downloadingText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
});
