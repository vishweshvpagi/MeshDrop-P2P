import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTransfers } from '../hooks/useTransfers';
import { TransferCard } from '../components/TransferCard';
import { Button } from '../components/Button';
import { Transfer } from '../types/transfer';

type FilterType = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export const TransfersScreen: React.FC = () => {
  const {
    transfers,
    activeTransfers,
    pendingIncomingTransfers,
    completedTransfers,
    terminalTransfers,
    isLoading,
    error,
    refresh,
    acceptTransfer,
    rejectTransfer,
    cancelTransfer,
    resumeTransfer,
    deleteTransfer,
  } = useTransfers();

  const [filter, setFilter] = useState<FilterType>('ALL');

  const filteredTransfers = () => {
    switch (filter) {
      case 'ACTIVE':
        return activeTransfers;
      case 'COMPLETED':
        return completedTransfers;
      case 'FAILED':
        return terminalTransfers;
      case 'ALL':
      default:
        return transfers;
    }
  };

  const currentList = filteredTransfers();

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>File Transfers</Text>
          <Text style={styles.subtitle}>
            {activeTransfers.length} active &bull; {completedTransfers.length} completed
          </Text>
        </View>
        <Button
          title="Refresh"
          variant="outline"
          size="sm"
          onPress={() => refresh()}
        />
      </View>

      {/* Prominent Incoming Transfer Alert Banner if waiting for accept */}
      {pendingIncomingTransfers.length > 0 && (
        <View style={styles.incomingAlertBox}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertIcon}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {pendingIncomingTransfers.length} Incoming Transfer{pendingIncomingTransfers.length > 1 ? 's' : ''} Awaiting Approval
              </Text>
              <Text style={styles.alertSubtitle}>
                Review and accept incoming files from remote peers
              </Text>
            </View>
          </View>

          {pendingIncomingTransfers.map((it) => (
            <TransferCard
              key={it.transferId || it.id}
              transfer={it}
              onAccept={acceptTransfer}
              onReject={rejectTransfer}
            />
          ))}
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {(['ALL', 'ACTIVE', 'COMPLETED', 'FAILED'] as FilterType[]).map((f) => {
          const isSelected = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, isSelected && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Transfers List */}
      {isLoading && transfers.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading transfers from backend...</Text>
        </View>
      ) : currentList.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>⇄</Text>
          <Text style={styles.emptyTitle}>No Transfers Found</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'ALL'
              ? 'No file transfers have been initiated yet.'
              : `No ${filter.toLowerCase()} transfers in history.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.transferId || item.id}
          renderItem={({ item }) => (
            <TransferCard
              transfer={item}
              onAccept={acceptTransfer}
              onReject={rejectTransfer}
              onCancel={cancelTransfer}
              onResume={resumeTransfer}
              onRemove={deleteTransfer}
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
  incomingAlertBox: {
    backgroundColor: '#fffbeb',
    borderBottomWidth: 2,
    borderBottomColor: '#fde68a',
    padding: 14,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  alertIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  alertSubtitle: {
    fontSize: 12,
    color: '#b45309',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  filterTabActive: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    textAlign: 'center',
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
    color: '#94a3b8',
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
  },
});
