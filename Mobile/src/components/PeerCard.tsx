import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Peer } from '../types/peer';
import { Badge } from './Badge';
import { Button } from './Button';

interface PeerCardProps {
  peer: Peer;
  isSelected?: boolean;
  onSelect?: (peer: Peer) => void;
  onConnect?: (peerId: string) => void;
  onDisconnect?: (peerId: string) => void;
  isConnecting?: boolean;
}

export const PeerCard: React.FC<PeerCardProps> = ({
  peer,
  isSelected = false,
  onSelect,
  onConnect,
  onDisconnect,
  isConnecting = false,
}) => {
  const isConnected = peer.connected || peer.state === 'CONNECTED';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onSelect?.(peer)}
      style={[styles.container, isSelected && styles.selectedContainer]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.displayName} numberOfLines={1}>
            💻 {peer.displayName}
          </Text>
          <Badge
            label={isConnected ? 'CONNECTED' : 'OFFLINE'}
            variant={isConnected ? 'success' : 'neutral'}
            withDot
          />
        </View>

        {peer.address ? (
          <Text style={styles.addressText}>
            {peer.address}:{peer.port}
          </Text>
        ) : (
          <Text style={styles.addressText}>Local / Discovered</Text>
        )}
      </View>

      <View style={styles.metaRow}>
        {peer.fingerprint ? (
          <Text style={styles.metaText} numberOfLines={1}>
            FP: {peer.fingerprint}
          </Text>
        ) : null}
        {peer.trustDecision ? (
          <Badge
            label={peer.trustDecision}
            variant={peer.trustDecision === 'TRUSTED' ? 'info' : 'neutral'}
            style={styles.trustBadge}
          />
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        {onSelect && isConnected && (
          <Button
            title={isSelected ? '✓ Selected as Target' : 'Select for Transfer'}
            variant={isSelected ? 'success' : 'primary'}
            size="sm"
            onPress={() => onSelect(peer)}
            style={styles.actionButton}
          />
        )}

        {!isConnected && onConnect && (
          <Button
            title="Connect"
            variant="outline"
            size="sm"
            isLoading={isConnecting}
            onPress={() => onConnect(peer.id)}
            style={styles.actionButton}
          />
        )}

        {isConnected && onDisconnect && (
          <Button
            title="Disconnect"
            variant="secondary"
            size="sm"
            onPress={() => onDisconnect(peer.id)}
            style={styles.disconnectBtn}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  selectedContainer: {
    borderColor: '#2563eb',
    backgroundColor: '#f8faff',
  },
  header: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  addressText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#64748b',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#94a3b8',
    flex: 1,
    marginRight: 8,
  },
  trustBadge: {
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  disconnectBtn: {
    paddingHorizontal: 10,
  },
});
