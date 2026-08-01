import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, ScrollView, Platform,
  StatusBar, Modal
} from 'react-native';
import {
  ArrowLeft, Search, Filter, MessageSquare,
  CheckCircle2, Clock, AlertCircle, ChevronRight,
  User, Check, X
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { SupportTicket } from '@/types/database';

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export default function AdminSupportScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch tickets first
      let ticketQuery = supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') {
        ticketQuery = ticketQuery.eq('status', statusFilter);
      }

      const { data: ticketData, error: ticketError } = await ticketQuery;
      if (ticketError) throw ticketError;

      if (!ticketData || ticketData.length === 0) {
        setTickets([]);
        return;
      }

      // 2. Extract unique user IDs
      const userIds = Array.from(new Set(ticketData.map(t => t.user_id)));

      // 3. Fetch profiles for these users
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profileError) {
        console.error('[AdminSupport] Profile fetch error:', profileError);
        // We continue anyway, just without profile info
      }

      // 4. Merge data in JavaScript
      const profileMap = (profileData || []).reduce((acc: Record<string, { name: string; email: string }>, p: { id: string; name: string; email: string }) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const mergedTickets = ticketData.map(ticket => ({
        ...ticket,
        profiles: profileMap[ticket.user_id] || { name: 'Unknown User', email: 'N/A' }
      }));

      setTickets(mergedTickets as any[]);
    } catch (err: any) {
      console.error('[AdminSupport] Fetch error:', err);
      Alert.alert('Error', 'Failed to load support tickets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;

      setTickets((prev: SupportTicket[]) => prev.map(t => t.id === ticketId ? { ...t, status: newStatus as SupportTicket['status'] } : t));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: newStatus as SupportTicket['status'] } : null);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const filteredTickets = tickets.filter(t =>
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.profiles?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.profiles?.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderTicket = ({ item }: { item: SupportTicket }) => {
    const statusColor = item.status === 'Open' ? colors.warning :
                        item.status === 'In Progress' ? '#3B82F6' :
                        item.status === 'Resolved' ? colors.emerald : '#666';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        onPress={() => setSelectedTicket(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.userBox}>
            <View style={[styles.avatar, { backgroundColor: colors.bgCard2 }]}>
              <User size={16} color={colors.textPrimary} />
            </View>
            <View>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>{item.profiles?.name || 'User'}</Text>
              <Text style={[styles.userEmail, { color: colors.textMuted }]}>{item.profiles?.email}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>

        <Text style={[styles.subject, { color: colors.textPrimary }]} numberOfLines={1}>{item.subject}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text>

        <View style={styles.cardFooter}>
          <Text style={[styles.date, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
          <ChevronRight size={16} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Tickets</Text>
      </View>

      <View style={styles.filtersContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search tickets..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters}>
          {STATUS_FILTERS.map(s => (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusTab,
                { backgroundColor: colors.bgCard, borderColor: colors.border },
                statusFilter === s && { borderColor: colors.emerald, backgroundColor: colors.emerald + '10' }
              ]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.statusTabText, { color: statusFilter === s ? colors.emerald : colors.textMuted }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.emerald} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          renderItem={renderTicket}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AlertCircle size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No tickets found</Text>
            </View>
          }
        />
      )}

      {/* Ticket Detail Modal */}
      <Modal visible={!!selectedTicket} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Ticket Details</Text>
              <TouchableOpacity onPress={() => setSelectedTicket(null)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Subject</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{selectedTicket.subject}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>User</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{selectedTicket.profiles?.name} ({selectedTicket.profiles?.email})</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Date</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{new Date(selectedTicket.created_at).toLocaleString()}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Message</Text>
                  <View style={[styles.messageBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.messageText, { color: colors.textPrimary }]}>{selectedTicket.description}</Text>
                  </View>
                </View>

                <Text style={[styles.detailLabel, { color: colors.textMuted, marginTop: 10, marginBottom: 12 }]}>Update Status</Text>
                <View style={styles.statusGrid}>
                  {STATUS_FILTERS.filter(s => s !== 'All').map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusBtn,
                        { borderColor: colors.border },
                        selectedTicket.status === s && { backgroundColor: colors.emerald, borderColor: colors.emerald }
                      ]}
                      onPress={() => handleUpdateStatus(selectedTicket.id, s)}
                      disabled={updating}
                    >
                      {updating && selectedTicket.status !== s && <ActivityIndicator size="small" color={colors.textMuted} style={{ marginRight: 6 }} />}
                      <Text style={[styles.statusBtnText, { color: selectedTicket.status === s ? '#000' : colors.textPrimary }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20,
    borderBottomWidth: 1
  },
  backBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  filtersContainer: { padding: 20, gap: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 12, height: 48, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },
  statusFilters: { flexDirection: 'row' },
  statusTab: { marginRight: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusTabText: { fontSize: 11, fontWeight: '700' },
  list: { padding: 20, gap: 16, paddingBottom: 40 },
  card: { padding: 16, borderRadius: 20, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  userBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 14, fontWeight: '700' },
  userEmail: { fontSize: 11 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  subject: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  message: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 11, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', marginTop: 100, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalBody: { marginBottom: 20 },
  detailSection: { marginBottom: 20 },
  detailLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  detailValue: { fontSize: 15, fontWeight: '600' },
  messageBox: { padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 4 },
  messageText: { fontSize: 14, lineHeight: 22 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusBtn: { flex: 1, minWidth: '45%', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row' },
  statusBtnText: { fontSize: 13, fontWeight: '700' }
});
