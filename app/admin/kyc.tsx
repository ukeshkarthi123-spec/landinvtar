import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, Image, TextInput, ScrollView
} from 'react-native';
import {
  Check, X, Eye, Search, Filter, Calendar,
  ArrowLeft, ExternalLink, ChevronRight, AlertCircle, FileText, Smartphone
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

interface KycVerification {
  id: string;
  user_id: string;
  pan_number: string;
  aadhaar_number: string;
  mobile_number: string;
  pan_file_url: string;
  aadhaar_file_url: string;
  selfie_file_url: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejection_reason: string | null;
  submitted_at: string;
  profiles: {
    name: string;
    email: string;
  };
}

export default function AdminKycScreen() {
  const { colors, isDark } = useTheme();
  const [verifications, setVerifications] = useState<KycVerification[]>([]);
  const [filteredData, setFilteredData] = useState<KycVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('Pending');

  // Modal State
  const [selectedKyc, setSelectedKyc] = useState<KycVerification | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchVerifications = async () => {
    try {
      const { data, error } = await supabase
        .from('kyc_documents')
        .select(`
          *,
          profiles:user_id (name, email)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setVerifications(data || []);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, []);

  useEffect(() => {
    let data = verifications;
    if (statusFilter !== 'all') {
      data = data.filter(v => v.status === statusFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(v =>
        v.profiles?.name?.toLowerCase().includes(s) ||
        v.pan_number?.toLowerCase().includes(s) ||
        v.mobile_number?.includes(s)
      );
    }
    setFilteredData(data);
  }, [search, statusFilter, verifications]);

  const handleAction = async (status: 'Approved' | 'Rejected') => {
    if (!selectedKyc) return;
    if (status === 'Rejected' && !remarks.trim()) {
      Alert.alert('Remarks Required', 'Please provide a reason for rejection.');
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('kyc_documents')
        .update({
          status,
          rejection_reason: status === 'Rejected' ? remarks : null,
          reviewed_at: status === 'Approved' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedKyc.id);

      if (error) throw error;

      Alert.alert('Success', `KYC request ${status} successfully.`);
      setSelectedKyc(null);
      setRemarks('');
      fetchVerifications();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const renderItem = ({ item }: { item: KycVerification }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      onPress={() => {
        setSelectedKyc(item);
        setRemarks(item.rejection_reason || '');
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{item.profiles?.name || 'Unknown'}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{item.profiles?.email}</Text>
        </View>
        <View style={[styles.badge, item.status === 'Pending' ? styles.badgePending : item.status === 'Approved' ? styles.badgeApproved : styles.badgeRejected]}>
          <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <FileText size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textPrimary }]}>PAN: {item.pan_number}</Text>
        </View>
        <View style={styles.detailRow}>
          <Smartphone size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textPrimary }]}>Mobile: {item.mobile_number || 'N/A'}</Text>
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.dateText, { color: colors.textMuted }]}>{new Date(item.submitted_at).toLocaleDateString()}</Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>KYC Management</Text>
      </View>

      {/* Search & Filters */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1 }]}>
          <Search size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search by name, PAN or phone..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {['all', 'Pending', 'Approved', 'Rejected'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.tab,
                { borderColor: colors.border },
                statusFilter === f && { backgroundColor: colors.emerald, borderColor: colors.emerald }
              ]}
              onPress={() => setStatusFilter(f as any)}
            >
              <Text style={[
                styles.tabText,
                { color: statusFilter === f ? '#fff' : colors.textSecondary }
              ]}>
                {f === 'all' ? 'All' : f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.emerald} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchVerifications();
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AlertCircle size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No KYC requests found</Text>
            </View>
          }
        />
      )}

      {/* Verification Modal */}
      <Modal visible={!!selectedKyc} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Review Documents</Text>
              <TouchableOpacity onPress={() => setSelectedKyc(null)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.userSummary}>
                <Text style={[styles.modalUserName, { color: colors.textPrimary }]}>{selectedKyc?.profiles?.name}</Text>
                <Text style={{ color: colors.textSecondary }}>{selectedKyc?.profiles?.email}</Text>
              </View>

              <Text style={[styles.docLabel, { color: colors.textMuted }]}>Identity Proofs</Text>
              <View style={styles.imageGrid}>
                <View style={styles.imageItem}>
                  <Text style={[styles.imageTitle, { color: colors.textSecondary }]}>PAN Card</Text>
                  {selectedKyc?.pan_file_url ? (
                    <Image source={{ uri: selectedKyc.pan_file_url }} style={styles.docImage} resizeMode="contain" />
                  ) : <Text style={{color: colors.error}}>Missing</Text>}
                </View>
                <View style={styles.imageItem}>
                  <Text style={[styles.imageTitle, { color: colors.textSecondary }]}>Aadhaar</Text>
                  {selectedKyc?.aadhaar_file_url ? (
                    <Image source={{ uri: selectedKyc.aadhaar_file_url }} style={styles.docImage} resizeMode="contain" />
                  ) : <Text style={{color: colors.error}}>Missing</Text>}
                </View>
                <View style={styles.imageItem}>
                  <Text style={[styles.imageTitle, { color: colors.textSecondary }]}>Selfie</Text>
                  {selectedKyc?.selfie_file_url ? (
                    <Image source={{ uri: selectedKyc.selfie_file_url }} style={styles.docImage} resizeMode="contain" />
                  ) : <Text style={{color: colors.error}}>Missing</Text>}
                </View>
              </View>

              {selectedKyc?.status === 'Pending' && (
                <View style={styles.actionForm}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Admin Remarks (Required for rejection)</Text>
                  <TextInput
                    style={[styles.remarksInput, { color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder="Enter rejection reason or comments..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    value={remarks}
                    onChangeText={setRemarks}
                  />

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => handleAction('Rejected')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reject</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => handleAction('Approved')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Approve</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60 },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  filterSection: { paddingHorizontal: 20, gap: 15 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderRadius: 12, height: 45 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
  tabs: { flexDirection: 'row', marginBottom: 10 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  tabText: { fontSize: 13, fontWeight: '600' },
  list: { padding: 20 },
  card: { borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  userName: { fontSize: 16, fontWeight: '700' },
  userEmail: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgePending: { backgroundColor: '#FFF7ED' },
  badgeApproved: { backgroundColor: '#F0FDF4' },
  badgeRejected: { backgroundColor: '#FEF2F2' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#000' },
  cardBody: { gap: 8, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10 },
  dateText: { fontSize: 11 },
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalScroll: { flex: 1 },
  userSummary: { marginBottom: 20 },
  modalUserName: { fontSize: 20, fontWeight: '800' },
  docLabel: { fontSize: 15, fontWeight: '700', marginBottom: 15 },
  imageGrid: { gap: 20 },
  imageItem: { gap: 8 },
  imageTitle: { fontSize: 13, fontWeight: '600' },
  docImage: { width: '100%', height: 250, borderRadius: 12, backgroundColor: '#f0f0f0' },
  actionForm: { marginTop: 30, gap: 15, paddingBottom: 50 },
  inputLabel: { fontSize: 13, fontWeight: '600' },
  remarksInput: { borderWidth: 1, borderRadius: 12, padding: 12, height: 80, textAlignVertical: 'top' },
  actionButtons: { flexDirection: 'row', gap: 15 },
  actionBtn: { flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#ef4444' },
  approveBtn: { backgroundColor: '#10b981' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});
