import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl } from 'react-native';
import { Wallet, Landmark, TrendingUp, Calendar, User, Search, Filter } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { Investment } from '@/types/database';

export default function InvestmentLogs() {
  const { colors } = useTheme();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('investments')
        .select('*, land_projects:project_id(name, location, category)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvestments((data || []) as Investment[]);
    } catch (error) {
      console.error('Error fetching investments:', error);
      Alert.alert('Error', 'Failed to fetch investment logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchInvestments(); }, [fetchInvestments]);

  const renderItem = ({ item }: { item: Investment }) => (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.projInfo}>
          <Text style={[styles.projName, { color: colors.textPrimary }]}>
            {item.land_projects?.name || 'Unknown Project'}
          </Text>
          <Text style={[styles.projLoc, { color: colors.textMuted }]}>
            {item.land_projects?.location || 'Unknown Location'}
          </Text>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: item.status === 'Active' ? colors.emeraldGlow : 'rgba(245,158,11,0.1)'
        }]}>
          <Text style={[styles.statusText, {
            color: item.status === 'Active' ? colors.success : colors.warning
          }]}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detail}>
          <Text style={[styles.detailLbl, { color: colors.textMuted }]}>Amount</Text>
          <Text style={[styles.detailVal, { color: colors.textPrimary }]}>₹{item.amount.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={[styles.detailLbl, { color: colors.textMuted }]}>ROI Rate</Text>
          <Text style={[styles.detailVal, { color: colors.emerald }]}>{item.roi_rate}%</Text>
        </View>
        <View style={styles.detail}>
          <Text style={[styles.detailLbl, { color: colors.textMuted }]}>User ID</Text>
          <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{item.user_id.slice(0, 8)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Calendar size={12} color={colors.textMuted} />
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Invested on {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {loading && !refreshing ? (
        <ActivityIndicator style={styles.loader} color={colors.emerald} size="large" />
      ) : (
        <FlatList
          data={investments}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInvestments(); }} tintColor={colors.emerald} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ color: colors.textMuted }}>No investments found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 40 },
  list: { padding: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  projInfo: { flex: 1, marginRight: 12 },
  projName: { fontSize: 16, fontWeight: '700' },
  projLoc: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  detailsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  detail: { gap: 4 },
  detailLbl: { fontSize: 10, fontWeight: '600' },
  detailVal: { fontSize: 14, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 12 },
  footerText: { fontSize: 11 },
  empty: { padding: 40, alignItems: 'center' }
});
