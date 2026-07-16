import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Smartphone, Plus, Trash2, Star, CheckCircle2, AlertCircle, X, Pencil } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import type { UpiId } from '@/types/database';

export default function UpiIdsScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useApp();
  const [upis, setUpis] = useState<UpiId[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newUpi, setNewUpi] = useState('');

  const fetchUpis = useCallback(async () => {
    const userId = profile?.id;
    if (!userId) {
      return;
    }

    try {
      const { data, error: err } = await supabase
        .from('upi_ids')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (err) throw err;
      console.log(`[UPI] Fetched ${data?.length || 0} IDs`);
      setUpis((data ?? []) as UpiId[]);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to load UPI IDs.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchUpis();
  }, [fetchUpis]);

  const resetForm = () => {
    setNewUpi('');
    setError(null);
    setEditingId(null);
  };

  const handleOpenEdit = (upi: UpiId) => {
    setNewUpi(upi.upi_id);
    setEditingId(upi.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    const userId = profile?.id;
    if (!userId) {
      setError('Please sign in again and try once more.');
      return;
    }

    const trimmed = newUpi.trim().toLowerCase();
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

    if (!upiRegex.test(trimmed)) {
      setError('Please enter a valid UPI ID (e.g. name@bank).');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('upi_ids')
          .update({ upi_id: trimmed, is_verified: false, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .eq('user_id', userId);

        if (updateError) throw updateError;
      } else {
        const isFirst = upis.length === 0;
        const { error: insertError } = await supabase
          .from('upi_ids')
          .insert({
            user_id: userId,
            upi_id: trimmed,
            is_verified: false,
            is_default: isFirst,
            created_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      await fetchUpis();
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Unable to save UPI ID.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (id: string) => {
    const userId = profile?.id;
    if (!userId) return;

    setVerifying(id);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const { error: updateError } = await supabase
        .from('upi_ids')
        .update({ is_verified: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (updateError) throw updateError;
      await fetchUpis();
      Alert.alert('Verified', 'Your UPI ID has been successfully verified.');
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Unable to verify UPI ID.');
    } finally {
      setVerifying(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    const userId = profile?.id;
    if (!userId) return;

    try {
      await supabase.from('upi_ids').update({ is_default: false }).eq('user_id', userId);
      const { error: updateError } = await supabase
        .from('upi_ids')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (updateError) throw updateError;
      await fetchUpis();
      Alert.alert('Success', 'Default UPI ID updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to update default UPI ID.');
    }
  };

  const handleDelete = (id: string, isDefault: boolean) => {
    Alert.alert(
      'Delete UPI ID',
      'Are you sure you want to remove this UPI ID?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const userId = profile?.id;
            if (!userId) return;

            try {
              const { error: delError } = await supabase
                .from('upi_ids')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);

              if (delError) throw delError;

              if (isDefault) {
                const { data: remaining } = await supabase
                  .from('upi_ids')
                  .select('id')
                  .eq('user_id', userId)
                  .order('created_at', { ascending: false })
                  .limit(1);

                if (remaining?.[0]?.id) {
                  await supabase
                    .from('upi_ids')
                    .update({ is_default: true })
                    .eq('id', remaining[0].id)
                    .eq('user_id', userId);
                }
              }

              await fetchUpis();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Unable to delete UPI ID.');
            }
          },
        },
      ]
    );
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <ScreenHeader
        title="UPI IDs"
        rightAction={
          <TouchableOpacity style={dynamicStyles.addBtn} onPress={() => { resetForm(); setShowModal(true); }}>
            <Plus size={20} color={colors.emerald} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={dynamicStyles.centered}>
          <ActivityIndicator color={colors.emerald} size="large" />
        </View>
      ) : upis.length === 0 ? (
        <View style={dynamicStyles.centered}>
          <Smartphone size={48} color={colors.textMuted} />
          <Text style={dynamicStyles.emptyTitle}>No UPI IDs</Text>
          <Text style={dynamicStyles.emptySub}>Add a UPI ID for fast and secure payments.</Text>
          <TouchableOpacity style={dynamicStyles.emptyBtn} onPress={() => { resetForm(); setShowModal(true); }}>
            <Plus size={16} color="#fff" />
            <Text style={dynamicStyles.emptyBtnText}>Add UPI ID</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scroll}>
          {error && (
            <View style={dynamicStyles.errorBox}>
              <AlertCircle size={14} color={colors.error} />
              <Text style={dynamicStyles.errorText}>{error}</Text>
            </View>
          )}
          {upis.map((upi) => (
            <View key={upi.id} style={[dynamicStyles.upiCard, upi.is_default && dynamicStyles.activeCard]}>
              <View style={[dynamicStyles.upiIcon, { backgroundColor: isDark ? colors.bgCard2 : '#FFFBEB' }]}>
                <Smartphone size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={dynamicStyles.upiHeader}>
                  <Text style={dynamicStyles.upiIdText}>{upi.upi_id}</Text>
                  {upi.is_default && (
                    <View style={dynamicStyles.defaultBadge}>
                      <CheckCircle2 size={10} color={colors.emerald} />
                      <Text style={dynamicStyles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                <View style={dynamicStyles.statusRow}>
                  {upi.is_verified ? (
                    <View style={dynamicStyles.verifiedTag}>
                      <CheckCircle2 size={12} color={colors.success} />
                      <Text style={dynamicStyles.verifiedText}>Verified</Text>
                    </View>
                  ) : verifying === upi.id ? (
                    <View style={dynamicStyles.verifyTag}>
                      <ActivityIndicator size={10} color={colors.warning} />
                      <Text style={dynamicStyles.verifyingText}>Verifying...</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={dynamicStyles.verifyBtn} onPress={() => handleVerify(upi.id)}>
                      <Text style={dynamicStyles.verifyBtnText}>Verify Now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={dynamicStyles.cardActions}>
                {!upi.is_default && (
                  <TouchableOpacity style={dynamicStyles.iconBtn} onPress={() => handleSetDefault(upi.id)} hitSlop={8}>
                    <Star size={16} color={colors.warning} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={dynamicStyles.iconBtn} onPress={() => handleOpenEdit(upi)} hitSlop={8}>
                  <Pencil size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.iconBtn} onPress={() => handleDelete(upi.id, upi.is_default)} hitSlop={8}>
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>{editingId ? 'Edit UPI ID' : 'Add UPI ID'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={dynamicStyles.closeBtn}>
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.inputGroup}>
              <Text style={dynamicStyles.inputLabel}>UPI ID *</Text>
              <TextInput
                style={dynamicStyles.input}
                placeholder="yourname@bank"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={newUpi}
                onChangeText={setNewUpi}
              />
            </View>

            {error && (
              <View style={[dynamicStyles.errorBox, { marginTop: 10 }]}>
                <AlertCircle size={14} color={colors.error} />
                <Text style={dynamicStyles.errorText}>{error}</Text>
              </View>
            )}

            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity style={dynamicStyles.cancelBtn} onPress={() => { setShowModal(false); resetForm(); }}>
                <Text style={dynamicStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dynamicStyles.saveBtnText}>{editingId ? 'Save' : 'Add'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function getDynamicStyles(colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    addBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: colors.emeraldGlow, alignItems: 'center', justifyContent: 'center',
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
    scroll: { padding: 20 },
    errorBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: colors.error + '33', marginBottom: 16,
    },
    errorText: { color: colors.error, fontSize: 13, lineHeight: 18, flex: 1 },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 8 },
    emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    emptyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.emerald, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14,
      marginTop: 12,
    },
    emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    upiCard: {
      flexDirection: 'row', alignItems: 'center', gap: 16,
      backgroundColor: colors.bgCard, borderRadius: 20, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 12,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    },
    activeCard: { borderColor: colors.emerald + '44', backgroundColor: isDark ? '#0D1A13' : '#F0FDF4' },
    upiIcon: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    upiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    upiIdText: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
    defaultBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.emeraldGlow, borderRadius: 20,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    defaultBadgeText: { color: colors.emerald, fontSize: 10, fontWeight: '700' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    verifiedTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    verifiedText: { color: colors.success, fontSize: 11, fontWeight: '700' },
    verifyTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    verifyingText: { color: colors.warning, fontSize: 11, fontWeight: '700' },
    verifyBtn: {
      backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    verifyBtnText: { color: colors.warning, fontSize: 11, fontWeight: '800' },
    cardActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    iconBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.bgCard2, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: colors.bgCard, borderTopLeftRadius: 32, borderTopRightRadius: 32,
      padding: 24,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '900' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgCard2, alignItems: 'center', justifyContent: 'center' },
    inputGroup: { marginBottom: 18 },
    inputLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
    input: {
      backgroundColor: colors.bgInput, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 16, color: colors.textPrimary, fontSize: 15, fontWeight: '500'
    },
    modalError: { color: colors.error, fontSize: 13, marginBottom: 10, textAlign: 'center' },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn: {
      flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
      backgroundColor: colors.bgCard2, borderWidth: 1, borderColor: colors.border,
    },
    cancelBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    saveBtn: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.emerald },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  });
}
