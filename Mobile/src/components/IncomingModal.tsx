import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Transfer } from '../types/transfer';
import { Button } from './Button';
import { formatBytes } from '../utils/formatters';

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
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!transfer) return null;

  const transferId = transfer.transferId || transfer.id;

  const handleAccept = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await onAccept(transferId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to accept transfer');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await onReject(transferId, 'User declined via mobile client');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to decline transfer');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={transfer !== null}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>📥</Text>
          </View>

          <Text style={styles.title}>Incoming File Transfer</Text>
          <Text style={styles.subtitle}>
            A remote peer wants to send you a file over MeshDrop P2P
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
                {transfer.fileName}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Size:</Text>
              <Text style={styles.detailValueBold}>{formatBytes(transfer.fileSize)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sender:</Text>
              <Text style={styles.detailValue}>{transfer.peerName || 'Remote Peer'}</Text>
            </View>

            {transfer.sha256 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SHA-256:</Text>
                <Text style={styles.hashText} numberOfLines={1}>
                  {transfer.sha256.substring(0, 16)}...
                </Text>
              </View>
            )}
          </View>

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
});
