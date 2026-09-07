import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Peer } from '../types/peer';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { formatBytes } from '../utils/formatters';
import { transfersApi } from '../api/transfers';

interface SendFileScreenProps {
  peers: Peer[];
  selectedPeer: Peer | null;
  onSelectPeer: (peer: Peer) => void;
  onTransferCreated: () => void;
  onNavigateToPeers: () => void;
}

interface PickedFile {
  name: string;
  size: number;
  uri: string;
  mimeType: string;
}

export const SendFileScreen: React.FC<SendFileScreenProps> = ({
  peers,
  selectedPeer,
  onSelectPeer,
  onTransferCreated,
  onNavigateToPeers,
}) => {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connectedPeers = peers.filter((p) => p.connected || p.state === 'CONNECTED');

  const handlePickDocument = async () => {
    setErrorMessage(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false, // Stream directly from storage provider
        multiple: false,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setFile({
          name: asset.name,
          size: asset.size || 0,
          uri: asset.uri,
          mimeType: asset.mimeType || 'application/octet-stream',
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to select file');
    }
  };

  const handleSend = async () => {
    if (!file) {
      setErrorMessage('Please select a file to send.');
      return;
    }
    if (!selectedPeer) {
      setErrorMessage('Please select a connected recipient peer.');
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    setStatusMessage('Streaming file to backend PC...');

    try {
      const res = await transfersApi.uploadAndStartTransfer(
        selectedPeer.id,
        file.uri,
        file.name,
        file.mimeType
      );

      setStatusMessage('Transfer initiated on MeshDrop P2P engine!');
      setFile(null);
      Alert.alert(
        'Transfer Started',
        `"${file.name}" is now being transferred to ${selectedPeer.displayName}.`,
        [
          {
            text: 'View Transfers',
            onPress: () => onTransferCreated(),
          },
        ]
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Transfer initiation failed');
    } finally {
      setIsSending(false);
      setStatusMessage(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Send File via MeshDrop</Text>
      <Text style={styles.subtitle}>
        Streams large files directly to the Java transfer engine without memory limits
      </Text>

      {/* Error / Status Banners */}
      {errorMessage && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
        </View>
      )}

      {statusMessage && (
        <View style={styles.statusCard}>
          <Text style={styles.statusText}>⏳ {statusMessage}</Text>
        </View>
      )}

      {/* Step 1: File Selection */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionStep}>1</Text>
          <Text style={styles.sectionTitle}>Select File</Text>
        </View>

        {file ? (
          <View style={styles.fileCard}>
            <View style={styles.fileIconBox}>
              <Text style={styles.fileIcon}>📄</Text>
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={2}>
                {file.name}
              </Text>
              <Text style={styles.fileMeta}>
                {formatBytes(file.size)} &bull; {file.mimeType}
              </Text>
            </View>
            <Button
              title="Change"
              variant="outline"
              size="sm"
              onPress={handlePickDocument}
              disabled={isSending}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.dropZone}
            activeOpacity={0.7}
            onPress={handlePickDocument}
            disabled={isSending}
          >
            <Text style={styles.dropZoneIcon}>📁</Text>
            <Text style={styles.dropZoneTitle}>Choose a File to Send</Text>
            <Text style={styles.dropZoneSubtitle}>
              Tap to browse documents, videos, archives, or any file
            </Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* Step 2: Peer Selection */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionStep}>2</Text>
          <Text style={styles.sectionTitle}>Select Recipient Peer</Text>
        </View>

        {connectedPeers.length === 0 ? (
          <View style={styles.noPeersBox}>
            <Text style={styles.noPeersText}>
              No connected peers available on your LAN.
            </Text>
            <Button
              title="Go to Peers Screen"
              variant="secondary"
              size="sm"
              onPress={onNavigateToPeers}
              style={{ marginTop: 8 }}
            />
          </View>
        ) : (
          <View style={styles.peersList}>
            {connectedPeers.map((p) => {
              const isSelected = selectedPeer?.id === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.peerOption, isSelected && styles.peerOptionSelected]}
                  onPress={() => onSelectPeer(p)}
                  disabled={isSending}
                >
                  <View style={styles.peerOptionRow}>
                    <Text style={styles.radioDot}>
                      {isSelected ? '🔘' : '⚪'}
                    </Text>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.peerOptionName}>{p.displayName}</Text>
                      <Text style={styles.peerOptionAddr}>
                        {p.address ? `${p.address}:${p.port}` : 'Local Node'}
                      </Text>
                    </View>
                    <Badge label="READY" variant="success" withDot />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Card>

      {/* Summary and Send Button */}
      {file && selectedPeer && (
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>TRANSFER CONFIRMATION</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>File:</Text>
            <Text style={styles.summaryVal} numberOfLines={1}>
              {file.name}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Size:</Text>
            <Text style={styles.summaryVal}>{formatBytes(file.size)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Destination:</Text>
            <Text style={[styles.summaryVal, { fontWeight: '700' }]}>
              {selectedPeer.displayName}
            </Text>
          </View>
        </Card>
      )}

      <Button
        title={isSending ? 'Streaming & Initiating Transfer...' : '🚀 Send File'}
        variant="primary"
        size="lg"
        disabled={!file || !selectedPeer || isSending}
        isLoading={isSending}
        onPress={handleSend}
        style={styles.sendButton}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '500',
  },
  statusCard: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  statusText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  },
  sectionCard: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionStep: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  dropZone: {
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  dropZoneIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  dropZoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  dropZoneSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fileIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fileIcon: {
    fontSize: 20,
  },
  fileInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  fileMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  noPeersBox: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  noPeersText: {
    fontSize: 13,
    color: '#b45309',
    textAlign: 'center',
  },
  peersList: {
    gap: 8,
  },
  peerOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  peerOptionSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  peerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioDot: {
    fontSize: 16,
  },
  peerOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  peerOptionAddr: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    marginBottom: 16,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  summaryVal: {
    fontSize: 13,
    color: '#0f172a',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  sendButton: {
    marginTop: 8,
  },
});
