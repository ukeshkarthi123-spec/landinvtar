import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, Image, TextInput, ScrollView
} from 'react-native';
import {
  Check, X, Eye, Search, Filter,
  ArrowLeft, ExternalLink, ChevronRight, AlertCircle, FileText, Smartphone,
  Image as ImageIcon
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import type { KycDocument, Profile } from '@/types/database';

const SecureDocImage = ({ url, label }: { url?: string | null; label: string }) => {
  return (
    <View style={styles.imageItem}>
      <Text style={[styles.imageTitle, { color: '#666' }]}>{label}</Text>
      <View style={[styles.docImageContainer, { backgroundColor: '#1C222B' }]}>
        {url ? (
          <Image source={{ uri: url }} style={styles.docImage} resizeMode="contain" />
        ) : (
          <View style={styles.imageError}>
            <AlertCircle size={32} color="#EF4444" />
            <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>Missing Document</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default function AdminKycScreen() {
  const { colors, isDark } = useTheme();
  const [requests, setRequests] = useState<(KycDocument & { profiles?: Profile })[]>([]);
  const [filteredData, setFilteredData] = useState<(KycDocument & { profiles?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const [selectedKyc, setSelectedKyc] = useState<(KycDocument & { profiles?: Profile }) | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchKYC = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*, profiles(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as any);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchKYC();
  }, []);

  useEffect(() => {
    let data = requests;
    if (statusFilter !== 'all') {
      data = data.filter(v => v.status === statusFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(v =>
        v.profiles?.name?.toLowerCase().includes(s) ||
        v.profiles?.email?.toLowerCase().includes(s) ||
        v.pan_number?.toLowerCase().includes(s) ||
        v.aadhaar_number?.toLowerCase().includes(s)
      );
    }
    setFilteredData(data);
  }, [search, statusFilter, requests]);

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!selectedKyc) return;
    if (status === 'rejected' && !remarks.trim()) {
      return Alert.alert('Remarks Required', 'Please provide a reason for rejection.');
    }

    setActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('kyc_documents')
        .update({
          status,
          rejection_reason: status === 'rejected' ? remarks : null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedKyc.id);

      if (error) throw error;

      Alert.alert('Success', `KYC request ${status} successfully.`);
      setSelectedKyc(null);
      setRemarks('');
      fetchKYC();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const renderItem = ({ item }: { item: KycDocument & { profiles?: Profile } }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      onPress={() => {
        setSelectedKyc(item);
        setRemarks(item.rejection_reason || '');
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{item.profiles?.name || 'Unknown User'}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{item.profiles?.email}</Text>
        </View>
        <View style={[styles.badge, item.status === 'pending' ? styles.badgePending : item.status === 'approved' ? styles.badgeApproved : styles.badgeRejected]}>
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
          <Text style={[styles.detailText, { color: colors.textPrimary }]}>Aadhaar: {item.aadhaar_number}</Text>
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.dateText, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Identity Verification</Text>
      </View>

      <View style={styles.filterSection}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1 }]}>
          <Search size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search by name, email, PAN..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {['all', 'pending', 'approved', 'rejected'].map((f) => (
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
                {f.toUpperCase()}
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
            fetchKYC();
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AlertCircle size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No KYC records found</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!selectedKyc} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Audit credentials</Text>
              <TouchableOpacity onPress={() => setSelectedKyc(null)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.userSummary}>
                <Text style={[styles.modalUserName, { color: colors.textPrimary }]}>{selectedKyc?.profiles?.name || 'Unknown'}</Text>
                <Text style={{ color: colors.textSecondary }}>{selectedKyc?.profiles?.email}</Text>
              </View>

              <View style={styles.imageGrid}>
                <SecureDocImage url={selectedKyc?.selfie} label="Selfie Biometric" />
                <SecureDocImage url={selectedKyc?.pan_image} label="PAN Card Master" />
                <SecureDocImage url={selectedKyc?.aadhaar_front} label="Aadhaar Front" />
                <SecureDocImage url={selectedKyc?.aadhaar_back} label="Aadhaar Back" />
              </View>

              {selectedKyc?.status === 'pending' && (
                <View style={styles.actionForm}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Audit Remarks (Required for rejection)</Text>
                  <TextInput
                    style={[styles.remarksInput, { color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder="Enter rejection reason..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    value={remarks}
                    onChangeText={setRemarks}
                  />

                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleAction('rejected')} disabled={actionLoading}>
                      <Text style={styles.btnText}>Reject Integrity</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleAction('approved')} disabled={actionLoading}>
                      <Text style={styles.btnText}>Approve node</Text>
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
  tabText: { fontSize: 11, fontWeight: '800' },
  list: { padding: 20 },
  card: { borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  userInfo: { flex: 1, marginRight: 12 },
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
  imageGrid: { gap: 20 },
  imageItem: { gap: 8 },
  imageTitle: { fontSize: 13, fontWeight: '600' },
  docImageContainer: { width: '100%', height: 250, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  docImage: { width: '100%', height: '100%' },
  imageError: { alignItems: 'center' },
  actionForm: { marginTop: 30, gap: 15, paddingBottom: 50 },
  inputLabel: { fontSize: 13, fontWeight: '600' },
  remarksInput: { borderWidth: 1, borderRadius: 12, padding: 12, height: 80, textAlignVertical: 'top' },
  actionButtons: { flexDirection: 'row', gap: 15 },
  actionBtn: { flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#ef4444' },
  approveBtn: { backgroundColor: '#10b981' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});
