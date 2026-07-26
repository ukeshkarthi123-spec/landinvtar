import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Smartphone, Plus, Trash2, Check, AlertCircle, Pencil, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import type { UpiId } from '@/types/database';

export default function UpiIdsScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useApp();
  const [upis, setUpiIds] = useState<UpiId[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [upiId, setUpiId] = useState('');

  const fetchUpis = useCallback(async () => {
    const userId = profile?.id;
    if (!userId) {
      setUpiIds([]);
      setLoading(false);
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
      setUpiIds((data ?? []) as UpiId[]);
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
    setUpiId('');
    setError(null);
    setEditingId(null);
  };

  const handleSave = async () => {
    const userId = profile?.id;
    if (!userId) {
      setError('Please sign in again.');
      return;
    }

    if (!upiId.trim() || !upiId.includes('@')) {
      setError('Please enter a valid UPI ID (e.g., name@bank).');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        user_id: userId,
        upi_id: upiId.trim().toLowerCase(),
      };

      if (editingId) {
        const { error: updateError } = await supabase.from('upi_ids').update(payload).eq('id', editingId).eq('user_id', userId);
        if (updateError) throw updateError;
      } else {
        const isFirst = upis.length === 0;
        const { error: insertError } = await supabase.from('upi_ids').insert({ ...payload, is_default: isFirst, is_verified: true });
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

  const handleDelete = (id: string) => {
    Alert.alert('Delete UPI ID', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('upi_ids').delete().eq('id', id);
            await fetchUpis();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="UPI IDs"
        rightAction={
          <TouchableOpacity style={styles.addHeaderBtn} onPress={() => { resetForm(); setShowModal(true); }}>
            <Plus size={20} color="#00E38C" />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color="#00E38C" size="large" /></View>
      ) : upis.length === 0 ? (
        <View style={styles.centered}>
          <Smartphone size={48} color="#444" />
          <Text style={styles.emptyTitle}>No UPI IDs Linked</Text>
          <Text style={styles.emptySub}>Add a UPI ID for instant withdrawals.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => { resetForm(); setShowModal(true); }}>
            <Text style={styles.emptyBtnText}>Link New UPI ID</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {upis.map((item) => (
            <View key={item.id} style={styles.upiCard}>
              <View style={styles.upiIconBox}>
                <Smartphone size={20} color="#00E38C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upiIdText}>{item.upi_id}</Text>
                <View style={styles.verifiedRow}>
                    <Check size={12} color="#00E38C" />
                    <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link UPI ID</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#fff" /></TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Enter UPI ID</Text>
            <View style={styles.inputWrapper}>
                <TextInput
                    style={styles.input}
                    placeholder="example@upi"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    value={upiId}
                    onChangeText={setUpiId}
                    autoFocus
                />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Verify & Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addHeaderBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#161B22', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2D333B' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 16 },
  emptySub: { color: '#666', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyBtn: { backgroundColor: '#00E38C', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, marginTop: 24 },
  emptyBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  scroll: { padding: 24 },
  upiCard: { backgroundColor: '#161B22', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#2D333B', marginBottom: 12 },
  upiIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(0, 227, 140, 0.1)', alignItems: 'center', justifyContent: 'center' },
  upiIdText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  verifiedText: { color: '#00E38C', fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#161B22', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  inputLabel: { color: '#A0A0A0', fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  inputWrapper: { backgroundColor: '#0F1115', borderRadius: 16, borderWidth: 1, borderColor: '#2D333B', paddingHorizontal: 16, height: 56, justifyContent: 'center' },
  input: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '600', marginTop: 12 },
  saveBtn: { backgroundColor: '#00E38C', borderRadius: 18, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
