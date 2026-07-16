import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { CreditCard, Plus, Trash2, Star, Check, AlertCircle, Building2, Pencil, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import type { BankAccount } from '@/types/database';

export default function BankAccountsScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useApp();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [holder, setHolder] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');

  const fetchAccounts = useCallback(async () => {
    const userId = profile?.id;
    if (!userId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error: err } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (err) throw err;
      console.log(`[Bank] Fetched ${data?.length || 0} accounts`);
      setAccounts((data ?? []) as BankAccount[]);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to load bank accounts.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const resetForm = () => {
    setHolder(profile?.name || '');
    setAccountNo('');
    setIfsc('');
    setBankName('');
    setBranch('');
    setError(null);
    setEditingId(null);
  };

  const handleOpenEdit = (acc: BankAccount) => {
    setHolder(acc.account_holder);
    setAccountNo(acc.account_number);
    setIfsc(acc.ifsc_code);
    setBankName(acc.bank_name);
    setBranch(acc.branch_name || '');
    setEditingId(acc.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    const userId = profile?.id;
    if (!userId) {
      setError('Please sign in again and try once more.');
      return;
    }

    if (!holder.trim() || !accountNo.trim() || !ifsc.trim() || !bankName.trim()) {
      setError('Please fill all required fields.');
      return;
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc.trim().toUpperCase())) {
      setError('Please enter a valid 11-character IFSC code.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        user_id: userId,
        account_holder: holder.trim(),
        account_number: accountNo.trim(),
        ifsc_code: ifsc.trim().toUpperCase(),
        bank_name: bankName.trim(),
        branch_name: branch.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from('bank_accounts')
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', userId);

        if (updateError) throw updateError;
      } else {
        const isFirst = accounts.length === 0;
        const { error: insertError } = await supabase
          .from('bank_accounts')
          .insert({
            ...payload,
            is_default: isFirst,
            created_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      await fetchAccounts();
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Unable to save bank account.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    const userId = profile?.id;
    if (!userId) return;

    try {
      await supabase.from('bank_accounts').update({ is_default: false }).eq('user_id', userId);
      const { error: updateError } = await supabase
        .from('bank_accounts')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);

      if (updateError) throw updateError;
      await fetchAccounts();
      Alert.alert('Success', 'Default bank account updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to update default bank account.');
    }
  };

  const handleDelete = (id: string, isDefault: boolean) => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to remove this bank account?',
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
                .from('bank_accounts')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);

              if (delError) throw delError;

              if (isDefault) {
                const { data: remaining } = await supabase
                  .from('bank_accounts')
                  .select('id')
                  .eq('user_id', userId)
                  .order('created_at', { ascending: false })
                  .limit(1);

                if (remaining?.[0]?.id) {
                  await supabase
                    .from('bank_accounts')
                    .update({ is_default: true, updated_at: new Date().toISOString() })
                    .eq('id', remaining[0].id)
                    .eq('user_id', userId);
                }
              }

              await fetchAccounts();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Unable to delete bank account.');
            }
          },
        },
      ]
    );
  };

  const maskNumber = (num: string) => {
    if (num.length <= 4) return num;
    return '**** **** ' + num.slice(-4);
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <ScreenHeader
        title="Bank Accounts"
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
      ) : accounts.length === 0 ? (
        <View style={dynamicStyles.centered}>
          <CreditCard size={48} color={colors.textMuted} />
          <Text style={dynamicStyles.emptyTitle}>No Bank Accounts</Text>
          <Text style={dynamicStyles.emptySub}>Add a bank account for easy withdrawals and investments.</Text>
          <TouchableOpacity style={dynamicStyles.emptyBtn} onPress={() => { resetForm(); setShowModal(true); }}>
            <Plus size={16} color="#fff" />
            <Text style={dynamicStyles.emptyBtnText}>Add First Account</Text>
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
          {accounts.map((acc) => (
            <View key={acc.id} style={[dynamicStyles.accountCard, acc.is_default && dynamicStyles.activeCard]}>
              <View style={dynamicStyles.cardHeader}>
                <View style={[dynamicStyles.bankIcon, { backgroundColor: isDark ? colors.bgCard2 : '#EFF6FF' }]}>
                  <Building2 size={20} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={dynamicStyles.bankName}>{acc.bank_name}</Text>
                  <Text style={dynamicStyles.accountHolder}>{acc.account_holder}</Text>
                </View>
                {acc.is_default && (
                  <View style={dynamicStyles.defaultBadge}>
                    <Check size={10} color={colors.emerald} />
                    <Text style={dynamicStyles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>

              <View style={dynamicStyles.cardDetails}>
                <View style={dynamicStyles.detailRow}>
                  <Text style={dynamicStyles.detailLabel}>Account Number</Text>
                  <Text style={dynamicStyles.detailValue}>{maskNumber(acc.account_number)}</Text>
                </View>
                <View style={dynamicStyles.detailRow}>
                  <Text style={dynamicStyles.detailLabel}>IFSC Code</Text>
                  <Text style={dynamicStyles.detailValue}>{acc.ifsc_code}</Text>
                </View>
                {acc.branch_name && (
                  <View style={dynamicStyles.detailRow}>
                    <Text style={dynamicStyles.detailLabel}>Branch</Text>
                    <Text style={dynamicStyles.detailValue}>{acc.branch_name}</Text>
                  </View>
                )}
              </View>

              <View style={dynamicStyles.cardActions}>
                {!acc.is_default && (
                  <TouchableOpacity style={dynamicStyles.actionBtn} onPress={() => handleSetDefault(acc.id)}>
                    <Star size={14} color={colors.warning} />
                    <Text style={dynamicStyles.actionText}>Set as Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[dynamicStyles.actionBtn, { marginLeft: acc.is_default ? 0 : 12 }]} onPress={() => handleOpenEdit(acc)}>
                  <Pencil size={14} color={colors.textSecondary} />
                  <Text style={dynamicStyles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[dynamicStyles.actionBtn, dynamicStyles.deleteBtn]} onPress={() => handleDelete(acc.id, acc.is_default)}>
                  <Trash2 size={14} color={colors.error} />
                  <Text style={[dynamicStyles.actionText, { color: colors.error }]}>Remove</Text>
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
              <Text style={dynamicStyles.modalTitle}>{editingId ? 'Edit Bank Account' : 'Add Bank Account'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={dynamicStyles.closeBtn}>
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>Account Holder Name *</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Legal name as per bank"
                  placeholderTextColor={colors.textMuted}
                  value={holder}
                  onChangeText={setHolder}
                />
              </View>

              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>Account Number *</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Enter account number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={accountNo}
                  onChangeText={setAccountNo}
                />
              </View>

              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>IFSC Code *</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="E.g. HDFC0001234"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  maxLength={11}
                  value={ifsc}
                  onChangeText={(t) => setIfsc(t.toUpperCase())}
                />
              </View>

              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>Bank Name *</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="E.g. HDFC Bank"
                  placeholderTextColor={colors.textMuted}
                  value={bankName}
                  onChangeText={setBankName}
                />
              </View>

              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>Branch Name (Optional)</Text>
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="E.g. Koramangala Branch"
                  placeholderTextColor={colors.textMuted}
                  value={branch}
                  onChangeText={setBranch}
                />
              </View>

              {error && (
                <View style={[dynamicStyles.errorBox, { marginTop: 10 }]}>
                  <AlertCircle size={14} color={colors.error} />
                  <Text style={dynamicStyles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity style={dynamicStyles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dynamicStyles.saveBtnText}>{editingId ? 'Save Changes' : 'Add Bank Account'}</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
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
    accountCard: {
      backgroundColor: colors.bgCard, borderRadius: 20, padding: 20,
      borderWidth: 1, borderColor: colors.border, marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    },
    activeCard: { borderColor: colors.emerald + '44', backgroundColor: isDark ? '#0D1A13' : '#F0FDF4' },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 },
    bankIcon: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    bankName: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 2 },
    accountHolder: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
    defaultBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.emeraldGlow, borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    defaultBadgeText: { color: colors.emerald, fontSize: 11, fontWeight: '700' },
    cardDetails: { gap: 12, marginBottom: 20 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
    detailValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
    cardActions: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    actionText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    deleteBtn: { marginLeft: 'auto' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: colors.bgCard, borderTopLeftRadius: 32, borderTopRightRadius: 32,
      padding: 24, maxHeight: '90%',
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
    saveBtn: { backgroundColor: colors.emerald, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
}

