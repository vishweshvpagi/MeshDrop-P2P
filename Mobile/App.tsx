import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PeersScreen } from './src/screens/PeersScreen';
import { SendFileScreen } from './src/screens/SendFileScreen';
import { TransfersScreen } from './src/screens/TransfersScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { IncomingModal } from './src/components/IncomingModal';
import { Badge } from './src/components/Badge';
import { usePeers } from './src/hooks/usePeers';
import { useTransfers } from './src/hooks/useTransfers';
import { useConnection } from './src/hooks/useConnection';
import { Peer } from './src/types/peer';

type Tab = 'peers' | 'send' | 'transfers' | 'settings';

function MainApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('peers');
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);

  const { isConnected, latencyMs, nodeStatus } = useConnection();
  const { peers } = usePeers();
  const {
    activeTransfers,
    pendingIncomingTransfers,
    acceptTransfer,
    rejectTransfer,
  } = useTransfers();

  // If there's an incoming transfer awaiting acceptance, we can surface the modal
  const activeIncomingOffer = pendingIncomingTransfers.length > 0 ? pendingIncomingTransfers[0] : null;

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      <StatusBar style="dark" />

      {/* Global Top Navbar */}
      <View style={styles.navHeader}>
        <View style={styles.brandRow}>
          <Text style={styles.brandLogo}>⚡</Text>
          <View>
            <Text style={styles.brandName}>MeshDrop</Text>
            <Text style={styles.brandSub}>P2P Mobile Client</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab('settings')}
          style={styles.connectionBadgeBtn}
        >
          <Badge
            label={isConnected ? `${latencyMs ?? 0}ms` : isConnected === false ? 'OFFLINE' : 'CONNECTING'}
            variant={isConnected ? 'success' : isConnected === false ? 'error' : 'warning'}
            withDot
          />
        </TouchableOpacity>
      </View>

      {/* Main Tab Screen Area */}
      <View style={styles.screenContainer}>
        {activeTab === 'peers' && (
          <PeersScreen
            selectedPeer={selectedPeer}
            onSelectPeer={(peer) => setSelectedPeer(peer)}
            onNavigateToSend={() => setActiveTab('send')}
          />
        )}

        {activeTab === 'send' && (
          <SendFileScreen
            peers={peers}
            selectedPeer={selectedPeer}
            onSelectPeer={(peer) => setSelectedPeer(peer)}
            onTransferCreated={() => setActiveTab('transfers')}
            onNavigateToPeers={() => setActiveTab('peers')}
          />
        )}

        {activeTab === 'transfers' && <TransfersScreen />}

        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'peers' && styles.tabItemActive]}
          onPress={() => setActiveTab('peers')}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>💻</Text>
          <Text style={[styles.tabLabel, activeTab === 'peers' && styles.tabLabelActive]}>
            Peers
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'send' && styles.tabItemActive]}
          onPress={() => setActiveTab('send')}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>📤</Text>
          <Text style={[styles.tabLabel, activeTab === 'send' && styles.tabLabelActive]}>
            Send
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'transfers' && styles.tabItemActive]}
          onPress={() => setActiveTab('transfers')}
          activeOpacity={0.7}
        >
          <View style={styles.tabIconWrapper}>
            <Text style={styles.tabIcon}>⇄</Text>
            {pendingIncomingTransfers.length > 0 ? (
              <View style={styles.badgeCountAlert}>
                <Text style={styles.badgeCountText}>{pendingIncomingTransfers.length}</Text>
              </View>
            ) : activeTransfers.length > 0 ? (
              <View style={styles.badgeCountActive}>
                <Text style={styles.badgeCountText}>{activeTransfers.length}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.tabLabel, activeTab === 'transfers' && styles.tabLabelActive]}>
            Transfers
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => setActiveTab('settings')}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal for Inbound Transfer Approval */}
      <IncomingModal
        transfer={activeIncomingOffer}
        onAccept={acceptTransfer}
        onReject={rejectTransfer}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogo: {
    fontSize: 22,
    marginRight: 8,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  connectionBadgeBtn: {
    padding: 2,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {
    borderTopColor: '#2563eb',
  },
  tabIconWrapper: {
    position: 'relative',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  badgeCountAlert: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeCountActive: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeCountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
