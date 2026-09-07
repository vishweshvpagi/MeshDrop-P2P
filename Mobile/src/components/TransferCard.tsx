import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Transfer } from '../types/transfer';
import { Badge, BadgeVariant } from './Badge';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import {
  formatBytes,
  formatSpeed,
  formatEta,
  calculatePercentage,
  formatTransferState,
} from '../utils/formatters';

interface TransferCardProps {
  transfer: Transfer;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  onResume?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export const TransferCard: React.FC<TransferCardProps> = ({
  transfer,
  onAccept,
  onReject,
  onCancel,
  onResume,
  onRemove,
}) => {
  const isIncoming = transfer.direction === 'INCOMING' || (transfer as any).direction === 'DOWNLOAD';
  const isWaitingApproval = transfer.state === 'WAITING_FOR_ACCEPT';
  const isTransferring = transfer.state === 'TRANSFERRING' || transfer.state === 'VERIFYING';
  const isCompleted = transfer.state === 'COMPLETED';
  const isFailed = transfer.state === 'FAILED' || transfer.state === 'TIMED_OUT';

  const percentage =
    transfer.progressPercentage ??
    calculatePercentage(transfer.transferredBytes, transfer.fileSize);

  const statusVariant: BadgeVariant = isCompleted
    ? 'success'
    : isWaitingApproval
    ? 'warning'
    : isFailed
    ? 'error'
    : isTransferring
    ? 'info'
    : 'neutral';

  return (
    <View style={styles.card}>
      {/* Header: File Name & Direction */}
      <View style={styles.headerRow}>
        <View style={styles.fileNameContainer}>
          <Text style={styles.fileIcon}>{isIncoming ? '📥' : '📤'}</Text>
          <Text style={styles.fileName} numberOfLines={1}>
            {transfer.fileName}
          </Text>
        </View>
        <Badge
          label={isIncoming ? 'INCOMING' : 'OUTGOING'}
          variant={isIncoming ? 'primary' : 'info'}
          style={styles.dirBadge}
        />
      </View>

      {/* Peer & Status Row */}
      <View style={styles.subRow}>
        <Text style={styles.peerText} numberOfLines={1}>
          Peer: <Text style={styles.peerBold}>{transfer.peerName || 'Remote Peer'}</Text>
        </Text>
        <Badge label={formatTransferState(transfer.state)} variant={statusVariant} withDot />
      </View>

      {/* Progress Bar (if not in waiting offer stage) */}
      {!isWaitingApproval && (
        <View style={styles.progressSection}>
          <ProgressBar
            progress={percentage}
            color={isCompleted ? '#16a34a' : isFailed ? '#dc2626' : '#2563eb'}
          />
          <View style={styles.progressDetailsRow}>
            <Text style={styles.progressText}>
              {formatBytes(transfer.transferredBytes)} / {formatBytes(transfer.fileSize)} ({Math.round(percentage)}%)
            </Text>

            {isTransferring && (
              <Text style={styles.metricsText}>
                {formatSpeed(transfer.speedBytesPerSecond || transfer.speed)} &bull; ETA {formatEta(transfer.etaSeconds ?? transfer.eta)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Error Message if present */}
      {transfer.errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} numberOfLines={2}>
            ⚠️ {transfer.errorMessage}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        {isWaitingApproval && isIncoming && (
          <View style={styles.approvalButtonsRow}>
            {onReject && (
              <Button
                title="Decline"
                variant="danger"
                size="sm"
                onPress={() => onReject(transfer.transferId || transfer.id)}
                style={styles.actionBtn}
              />
            )}
            {onAccept && (
              <Button
                title="Accept & Download"
                variant="success"
                size="sm"
                onPress={() => onAccept(transfer.transferId || transfer.id)}
                style={[styles.actionBtn, { flex: 2 }]}
              />
            )}
          </View>
        )}

        {!isWaitingApproval && (
          <View style={styles.standardActionsRow}>
            {transfer.canResume && onResume && (
              <Button
                title="Resume"
                variant="primary"
                size="sm"
                onPress={() => onResume(transfer.transferId || transfer.id)}
                style={styles.actionBtn}
              />
            )}

            {transfer.canCancel && onCancel && (
              <Button
                title="Cancel"
                variant="secondary"
                size="sm"
                onPress={() => onCancel(transfer.transferId || transfer.id)}
                style={styles.actionBtn}
              />
            )}

            {transfer.canRemove && onRemove && (
              <Button
                title="Remove"
                variant="outline"
                size="sm"
                onPress={() => onRemove(transfer.transferId || transfer.id)}
                style={styles.actionBtn}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fileNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  fileIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  dirBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  peerText: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  peerBold: {
    color: '#0f172a',
    fontWeight: '600',
  },
  progressSection: {
    marginVertical: 4,
  },
  progressDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  metricsText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  actionsRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  approvalButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  standardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
  },
});
