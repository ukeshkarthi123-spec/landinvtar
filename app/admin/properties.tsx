import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Image, RefreshControl, ScrollView, Modal, TextInput } from 'react-native';
import { Landmark, Plus, Edit2, Trash2, CheckCircle2, XCircle, MapPin, TrendingUp, Layers, Info } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { LandProject } from '@/types/database';

export default function PropertyManagement() {
  const { colors } = useTheme();
  const [properties, setProperties] = useState<LandProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('land_projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProperties((data || []) as LandProject[]);
    } catch (error) {
      console.error('Error fetching properties:', error);
      Alert.alert('Error', 'Failed to fetch properties');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('land_projects')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      fetchProperties();
    }
  };

  const renderProperty = ({ item }: { item: LandProject }) => (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <Image source={{ uri: item.image }} style={styles.image} />
        <View style={styles.badgeContainer}>
           <View style={[styles.statusBadge, { backgroundColor: item.is_active ? colors.emeraldGlow : 'rgba(239,68,68,0.1)' }]}>
             <Text style={[styles.statusText, { color: item.is_active ? colors.success : colors.error }]}>
               {item.is_active ? 'ACTIVE' : 'INACTIVE'}
             </Text>
           </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
        <View style={styles.locRow}>
          <MapPin size={12} color={colors.textMuted} />
          <Text style={[styles.location, { color: colors.textSecondary }]}>{item.location}, {item.city}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <TrendingUp size={14} color={colors.emerald} />
            <Text style={[styles.statVal, { color: colors.textPrimary }]}>{item.expected_roi}%</Text>
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>ROI</Text>
          </View>
          <View style={styles.stat}>
            <Layers size={14} color="#3B82F6" />
            <Text style={[styles.statVal, { color: colors.textPrimary }]}>{item.total_area}</Text>
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>Area</Text>
          </View>
          <View style={styles.stat}>
            <Landmark size={14} color="#F59E0B" />
            <Text style={[styles.statVal, { color: colors.textPrimary }]}>{item.funding_progress}%</Text>
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>Funded</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.bgInput }]}
            onPress={() => Alert.alert('Edit', 'Edit functionality to be implemented')}
          >
            <Edit2 size={16} color={colors.textPrimary} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: item.is_active ? 'rgba(239,68,68,0.1)' : colors.emeraldGlow }]}
            onPress={() => toggleStatus(item.id, item.is_active)}
          >
            {item.is_active ? <XCircle size={16} color={colors.error} /> : <CheckCircle2 size={16} color={colors.emerald} />}
            <Text style={[styles.actionBtnText, { color: item.is_active ? colors.error : colors.emerald }]}>
              {item.is_active ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {loading && !refreshing ? (
        <ActivityIndicator style={styles.loader} color={colors.emerald} size="large" />
      ) : (
        <FlatList
          data={properties}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderProperty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProperties(); }} tintColor={colors.emerald} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ color: colors.textMuted }}>No properties found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.emerald }]}
        onPress={() => Alert.alert('Add New', 'Add property form to be implemented')}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 100 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  cardTop: { height: 160, position: 'relative' },
  image: { width: '100%', height: '100%' },
  badgeContainer: { position: 'absolute', top: 12, right: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800' },
  cardBody: { padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  location: { fontSize: 13 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: 2 },
  statVal: { fontSize: 14, fontWeight: '700' },
  statLbl: { fontSize: 10 },
  divider: { height: 1, backgroundColor: '#000', opacity: 0.1, marginVertical: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  empty: { padding: 40, alignItems: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 }
});
