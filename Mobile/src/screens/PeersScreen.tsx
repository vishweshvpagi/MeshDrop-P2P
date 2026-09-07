import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { usePeers } from '../hooks/usePeers';
import { PeerCard } from '../components/PeerCard';
import { Button } from '../components/Button';
import { Peer } from '../types/peer';

interface PeersScreenProps {
  selectedPeer: Peer | null;
  onSelectPeer: (peer: Peer) => void;
  onNavigateToSend: () => void;
}

export const PeersScreen: React.FC<PeersScreenProps> = ({
  selectedPeer,
  onSelectPeer,
  onNavigateToSend,
}) => {
  const {
    peers,
    connectedPeers,
    isLoading,
    error,
    refresh,
    connectPeer,
    disconnectPeer,
  } = usePeers();

  const [connectingPeerId, setConnectingPeerId] = useState<string | null>(null);

  const handleConnect = async (peerId: string) => {
    setConnectingPeerId(peerId);
    await connectPeer(peerId);
    setConnectingPeerId(null);
  };

  const handleSelect = (peer: Peer) => {
    onSelectPeer(peer);
    if (peer.connected || peer.state === 'CONNECTED') {
      onNavigateToSend();
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Banner / Stats */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Discovered Peers</Text>
          <Text style={styles.subtitle}>
            {connectedPeers.length} of {peers.length} peers connected on LAN
          </Text>
        </View>
        <Button
          title="Refresh"
          variant="outline"
          size="sm"
          onPress={() => refresh()}
        />
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <Button
            title="Retry"
            variant="secondary"
            size="sm"
            onPress={() => refresh()}
            style={styles.retryBtn}
          />
        </View>
      )}

      {/* Peers List */}
      {isLoading && peers.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Discovering MeshDrop peers on local network...</Text>
        </View>
      ) : peers.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No Peers Discovered Yet</Text>
          <Text style={styles.emptySubtitle}>
            Make sure other MeshDrop PCs are running on the same Wi-Fi network.
            UDP discovery runs automatically every 2 seconds.
          </Text>
          <Button
            title="Scan Again"
            variant="primary"
            size="md"
            onPress={() => refresh()}
            style={styles.scanBtn}
          />
        </View>
      ) : (
        <FlatList
          data={peers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PeerCard
              peer={item}
              isSelected={selectedPeer?.id === item.id}
              onSelect={handleSelect}
              onConnect={handleConnect}
              onDisconnect={disconnectPeer}
              isConnecting={connectingPeerId === item.id}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refresh}
              colors={['#2563eb']}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    flex: 1,
    marginRight: 8,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  listContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  scanBtn: {
    minWidth: 140,
  },
});
