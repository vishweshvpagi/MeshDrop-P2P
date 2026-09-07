import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useConnection } from '../hooks/useConnection';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { normalizeUrl } from '../api/config';

export const SettingsScreen: React.FC = () => {
  const {
    baseUrl,
    isConnected,
    latencyMs,
    nodeStatus,
    error,
    isChecking,
    checkConnection,
    updateBaseUrl,
    resetBaseUrl,
  } = useConnection();

  const [inputUrl, setInputUrl] = useState<string>(baseUrl);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isAndroidLoopback =
    Platform.OS === 'android' && (inputUrl.includes('127.0.0.1') || inputUrl.includes('localhost'));

  useEffect(() => {
    setInputUrl(baseUrl);
  }, [baseUrl]);

  const handleApplyPreset = (preset: string) => {
    setInputUrl(preset);
  };

  const handleSaveAndTest = async () => {
    if (!inputUrl.trim()) {
      Alert.alert('Invalid URL', 'Please enter a valid backend URL.');
      return;
    }
    const cleaned = normalizeUrl(inputUrl);
    if (Platform.OS === 'android' && (cleaned.includes('127.0.0.1') || cleaned.includes('localhost'))) {
      Alert.alert(
        'Android Loopback Warning',
        '127.0.0.1 and localhost point to your phone itself, NOT your PC!\n\nAre you sure you want to save this?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save Anyway',
            onPress: async () => {
              setIsSaving(true);
              await updateBaseUrl(cleaned);
              setIsSaving(false);
            },
          },
        ]
      );
      return;
    }

    setIsSaving(true);
    await updateBaseUrl(cleaned);
    setIsSaving(false);
  };

  const handleResetDefault = async () => {
    setIsSaving(true);
    const restored = await resetBaseUrl();
    setInputUrl(restored);
    setIsSaving(false);
    Alert.alert('Reset Complete', `Restored default backend URL:\n${restored}`);
  };

  const formatUptime = (ms?: number) => {
    if (!ms) return '--';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const h = Math.floor(m / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m % 60}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>MeshDrop Backend</Text>
      <Text style={styles.subtitle}>
        Connect your mobile device to the Java transfer engine running on your laptop over Wi-Fi
      </Text>

      {/* URL Configuration Card */}
      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Backend URL</Text>
        <Text style={styles.inputHint}>
          Enter your laptop's Wi-Fi IP address (e.g. http://192.168.29.188:8080 as shown in .\start-meshdrop.ps1).
        </Text>

        <TextInput
          style={styles.textInput}
          value={inputUrl}
          onChangeText={setInputUrl}
          placeholder="http://192.168.1.100:8080"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        {isAndroidLoopback && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ Android Loopback Warning</Text>
            <Text style={styles.warningText}>
              On Android, <Text style={styles.boldText}>127.0.0.1</Text> and <Text style={styles.boldText}>localhost</Text> point to your phone itself, NOT your PC!
              {'\n\n'}• <Text style={styles.boldText}>Physical Phone on Wi-Fi:</Text> Enter your PC's Wi-Fi LAN IP (check the terminal output from <Text style={styles.monoText}>.\start-meshdrop.ps1</Text>).
              {'\n'}• <Text style={styles.boldText}>Android Emulator:</Text> Tap the <Text style={styles.boldText}>Emulator (10.0.2.2)</Text> preset below.
            </Text>
          </View>
        )}

        <Text style={styles.presetLabel}>Quick Presets:</Text>
        <View style={styles.presetRow}>
          <Button
            title="🤖 Emulator (10.0.2.2)"
            variant="secondary"
            size="sm"
            onPress={() => handleApplyPreset('http://10.0.2.2:8080')}
            style={styles.presetBtn}
          />
          <Button
            title="📡 Wi-Fi Template (192.168.x.x)"
            variant="secondary"
            size="sm"
            onPress={() => handleApplyPreset('http://192.168.1.100:8080')}
            style={styles.presetBtn}
          />
        </View>

        <View style={styles.buttonActionRow}>
          <Button
            title={isSaving || isChecking ? 'Connecting...' : '💾 Save & Test Connection'}
            variant="primary"
            size="md"
            isLoading={isSaving || isChecking}
            onPress={handleSaveAndTest}
            style={{ flex: 2 }}
          />
          <Button
            title="🔄 Reset to Default"
            variant="outline"
            size="md"
            onPress={handleResetDefault}
            style={{ flex: 1.2 }}
          />
        </View>
      </Card>

      {/* Connection Status Card */}
      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={styles.statusTitleGroup}>
            <Text style={styles.statusTitle}>Connection Health</Text>
            {latencyMs != null && isConnected && (
              <Text style={styles.latencyText}>{latencyMs}ms latency</Text>
            )}
          </View>
          <Badge
            label={isConnected ? 'CONNECTED' : isConnected === false ? 'UNABLE TO CONNECT' : 'CHECKING...'}
            variant={isConnected ? 'success' : isConnected === false ? 'error' : 'warning'}
            withDot
          />
        </View>

        {isConnected && nodeStatus ? (
          <View style={styles.nodeDetails}>
            <View style={styles.nodeDetailRow}>
              <Text style={styles.nodeDetailLabel}>Status:</Text>
              <Text style={styles.nodeConnectedText}>Connected & Ready</Text>
            </View>
            <View style={styles.nodeDetailRow}>
              <Text style={styles.nodeDetailLabel}>Node Name:</Text>
              <Text style={styles.nodeDetailValBold}>{nodeStatus.displayName}</Text>
            </View>
            <View style={styles.nodeDetailRow}>
              <Text style={styles.nodeDetailLabel}>Node ID:</Text>
              <Text style={styles.nodeDetailValMono} numberOfLines={1}>
                {nodeStatus.nodeId}
              </Text>
            </View>
            <View style={styles.nodeDetailRow}>
              <Text style={styles.nodeDetailLabel}>TCP Engine Port:</Text>
              <Text style={styles.nodeDetailVal}>{nodeStatus.tcpPort}</Text>
            </View>
            <View style={styles.nodeDetailRow}>
              <Text style={styles.nodeDetailLabel}>Active Peers:</Text>
              <Text style={styles.nodeDetailVal}>{nodeStatus.peerCount}</Text>
            </View>
            <View style={styles.nodeDetailRow}>
              <Text style={styles.nodeDetailLabel}>Engine Uptime:</Text>
              <Text style={styles.nodeDetailVal}>{formatUptime(nodeStatus.uptimeMillis)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.disconnectedBox}>
            <Text style={styles.disconnectedTitle}>Unable to connect to backend</Text>
            <Text style={styles.disconnectedBody}>
              {error || 'The mobile app cannot reach the Java backend server at the specified URL.'}
            </Text>
            <View style={styles.troubleSteps}>
              <Text style={styles.troubleStep}>• Ensure phone & PC are connected to the same Wi-Fi.</Text>
              <Text style={styles.troubleStep}>• Check start-meshdrop.ps1 terminal for your PC's Wi-Fi IP.</Text>
              <Text style={styles.troubleStep}>• Make sure port 8080 is not blocked by Windows Firewall.</Text>
            </View>
          </View>
        )}

        <View style={styles.statusActionRow}>
          <Button
            title="🔄 Retry Health Check"
            variant="outline"
            size="sm"
            isLoading={isChecking}
            onPress={() => checkConnection(inputUrl)}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      {/* Architecture Information Card */}
      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>MeshDrop Mobile Architecture</Text>
        <Text style={styles.infoBody}>
          &bull; The Android app functions strictly as a mobile UI and control panel.
          {'\n'}&bull; The Java backend running on your PC acts as the high-speed P2P transfer engine.
          {'\n'}&bull; Selected files stream directly from Android storage to the PC via 64 KiB chunks ($O(1)$ RAM).
          {'\n'}&bull; Large files (e.g. 1.44 GB movies) are transferred reliably without crashing mobile memory.
        </Text>
      </Card>
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
  statusCard: {
    marginBottom: 14,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusTitleGroup: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  latencyText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
  },
  nodeDetails: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginVertical: 10,
    gap: 6,
  },
  nodeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeDetailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  nodeDetailVal: {
    fontSize: 12,
    color: '#0f172a',
  },
  nodeDetailValBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  nodeDetailValMono: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#475569',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  statusActionRow: {
    marginTop: 6,
  },
  sectionCard: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  inputHint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 16,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#0f172a',
    marginBottom: 12,
  },
  warningBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b45309',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  monoText: {
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  buttonActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  nodeConnectedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  disconnectedBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
  },
  disconnectedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 4,
  },
  disconnectedBody: {
    fontSize: 12,
    color: '#991b1b',
    lineHeight: 16,
    marginBottom: 8,
  },
  troubleSteps: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#fee2e2',
    paddingTop: 6,
    gap: 3,
  },
  troubleStep: {
    fontSize: 11,
    color: '#7f1d1d',
    lineHeight: 15,
  },
  saveBtn: {
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoBody: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
});
