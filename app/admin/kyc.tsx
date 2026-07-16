import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl, Modal, TextInput } from 'react-native';
import { Shield, CheckCircle2, XCircle } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { KycDocument, Profile } from '@/types/database';

export default function KycApprovals() {
  const { colors } = useTheme();
  const [kycList, setKycList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedKyc, setSelectedKyc] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchKyc = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch KYC documents
      const { data: docs, error: kycError } = await supabase
        .from('kyc_documents')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (kycError) throw kycError;

      if (!docs || docs.length === 0) {
        setKycList([]);
        return;
      }

      // 2. Fetch profiles separately
      const userIds = [...new Set(docs.map(doc => doc.user_id))];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profileError) throw profileError;

      // 3. Merge
      const profileMap = (profiles || []).reduce((acc: any, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const merged = docs.map(doc => ({
        ...doc,
        profiles: profileMap[doc.user_id] || null
      }));

      setKycList(merged);
    } catch (error) {
      console.error('Error fetching KYC:', error);
      Alert.alert('Error', 'Failed to fetch KYC submissions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchKyc();
  }, [fetchKyc]);

  const handleApprove = async (kyc: any) => {
    setProcessing(true);
    try {
      const { error: kycError } = await supabase
        .from('kyc_documents')
        .update({
          status: 'Approved',
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', kyc.id);

      if (kycError) throw kycError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ kyc_status: 'Verified', updated_at: new Date().toISOString() })
        .eq('id', kyc.user_id);

      if (profileError) throw profileError;

      Alert.alert('Success', 'KYC approved successfully');
      await fetchKyc();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedKyc || !rejectReason.trim()) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('kyc_documents')
        .update({
          status: 'Rejected',
          rejection_reason: rejectReason.trim(),
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedKyc.id);

      if (error) throw error;

      await supabase
        .from('profiles')
        .update({ kyc_status: 'Pending', updated_at: new Date().toISOString() })
        .eq('id', selectedKyc.user_id);

      setIsRejectModalVisible(false);
      setSelectedKyc(null);
      setRejectReason('');
      Alert.alert('Success', 'KYC rejected');
      await fetchKyc();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setProcessing(false);
    }
  };

  const renderKycItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
      <View style={styles.cardHeader}>
        <View style={styles.userRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.bgInput }]}> 
            <Shield size={20} color={colors.emerald} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{item.profiles?.name || 'Unknown'}</Text>
            <Text style={[styles.date, { color: colors.textMuted }]}>Submitted: {new Date(item.submitted_at).toLocaleDateString()}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: item.status === 'Approved' ? colors.emeraldGlow :
                           item.status === 'Rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'
        }]}> 
          <Text style={[styles.statusText, {
            color: item.status === 'Approved' ? colors.success :
                   item.status === 'Rejected' ? colors.error : colors.warning
          }]}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={[styles.detailText, { color: colors.textSecondary }]}>PAN: {item.pan_number || 'Not provided'}</Text>
        <Text style={[styles.detailText, { color: colors.textSecondary }]}>Aadhaar: {item.aadhaar_number || 'Not provided'}</Text>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>Email: {item.profiles?.email}</Text>
        {item.rejection_reason ? (
          <Text style={[styles.detailText, { color: colors.error, marginTop: 4 }]}>Reason: {item.rejection_reason}</Text>
        ) : null}
      </View>

      {item.status === 'Pending' ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.emeraldGlow }]}
            onPress={() => handleApprove(item)}
            disabled={processing}
          >
            <CheckCircle2 size={16} color={colors.emerald} />
            <Text style={[styles.actionBtnText, { color: colors.emerald }]}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
            onPress={() => { setSelectedKyc(item); setIsRejectModalVisible(true); }}
            disabled={processing}
          >
            <XCircle size={16} color={colors.error} />
            <Text style={[styles.actionBtnText, { color: colors.error }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}> 
      {loading && !refreshing ? (
        <ActivityIndicator style={styles.loader} color={colors.emerald} size="large" />
      ) : (
        <FlatList
          data={kycList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderKycItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchKyc(); }} tintColor={colors.emerald} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ color: colors.textMuted }}>No KYC submissions found</Text>
            </View>
          }
        />
      )}

      <Modal visible={isRejectModalVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}> 
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}> 
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Reject KYC</Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>Provide a reason for rejection to the user</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.bgInput, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="e.g. Document image is not clear..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              value={rejectReason}
              onChangeText={setRejectReason}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.bgInput }]} onPress={() => { setIsRejectModalVisible(false); setSelectedKyc(null); }}>
                <Text style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectBtn, { backgroundColor: colors.error }]}
                onPress={handleReject}
                disabled={processing || !rejectReason.trim()}
              >
                {processing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnTextWhite}>Reject</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 40 },
  list: { padding: 16 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 11, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  details: { paddingLeft: 52 },
  detailText: { fontSize: 13, marginBottom: 2 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16, paddingLeft: 52 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  empty: { padding: 40, alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  modalInput: { borderRadius: 12, borderWidth: 1, padding: 12, minHeight: 100, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center' },
  rejectBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center' },
  btnText: { fontSize: 14, fontWeight: '700' },
  btnTextWhite: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
