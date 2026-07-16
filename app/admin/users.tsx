import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Image, RefreshControl } from 'react-native';
import { Search, UserX, UserCheck, Shield, ChevronRight, Mail, Phone, Calendar } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function UserManagement() {
  const { colors } = useTheme();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    Alert.alert(
      currentStatus ? 'Deactivate User' : 'Activate User',
      `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: currentStatus ? 'Deactivate' : 'Activate',
          style: currentStatus ? 'destructive' : 'default',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .update({ is_active: !currentStatus })
              .eq('id', id);

            if (error) {
              Alert.alert('Error', error.message);
            } else {
              fetchUsers();
            }
          }
        }
      ]
    );
  };

  const filteredUsers = users.filter(u =>
    (u.name || u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.id.toLowerCase().includes(search.toLowerCase())
  );

  const renderUser = ({ item }: { item: any }) => (
    <View style={[styles.userCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.bgInput }]}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                {(item.name || item.full_name || 'U').charAt(0)}
              </Text>
            )}
          </View>
          <View style={styles.userDetails}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {item.name || item.full_name || 'Unnamed User'}
              </Text>
              {item.is_admin && (
                <View style={[styles.adminBadge, { backgroundColor: colors.emeraldGlow }]}>
                  <Shield size={10} color={colors.emerald} />
                  <Text style={[styles.adminBadgeText, { color: colors.emerald }]}>ADMIN</Text>
                </View>
              )}
            </View>
            <Text style={[styles.userId, { color: colors.textMuted }]}>ID: {item.id.slice(0, 8)}</Text>
          </View>
        </View>
        <View style={styles.statusSection}>
           <View style={[styles.activeIndicator, { backgroundColor: item.is_active ? colors.success : colors.error }]} />
           <Text style={[styles.statusText, { color: item.is_active ? colors.success : colors.error }]}>
             {item.is_active ? 'Active' : 'Inactive'}
           </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.contactInfo}>
        <View style={styles.infoRow}>
          <Mail size={14} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>{item.email}</Text>
        </View>
        <View style={[styles.infoRow, { marginTop: 6 }]}>
          <Phone size={14} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>{item.phone || 'No phone'}</Text>
        </View>
        <View style={[styles.infoRow, { marginTop: 6 }]}>
          <Calendar size={14} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Joined: {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: item.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(22,199,132,0.1)' }]}
          onPress={() => toggleUserStatus(item.id, item.is_active)}
        >
          {item.is_active ? (
            <>
              <UserX size={16} color="#EF4444" />
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Deactivate</Text>
            </>
          ) : (
            <>
              <UserCheck size={16} color={colors.emerald} />
              <Text style={[styles.actionBtnText, { color: colors.emerald }]}>Activate</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.bgInput }]}>
          <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>View History</Text>
          <ChevronRight size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.searchContainer, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.bgInput }]}>
          <Search size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search users..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={styles.loader} color={colors.emerald} size="large" />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderUser}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} tintColor={colors.emerald} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ color: colors.textMuted }}>No users found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { padding: 16, borderBottomWidth: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12 },
  searchInput: { flex: 1, padding: 12, fontSize: 16 },
  loader: { marginTop: 40 },
  list: { padding: 16, gap: 16 },
  userCard: { borderRadius: 20, borderWidth: 1, padding: 16 },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  userDetails: { gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 16, fontWeight: '700' },
  userId: { fontSize: 11 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText: { fontSize: 8, fontWeight: '900' },
  statusSection: { alignItems: 'flex-end', gap: 4 },
  activeIndicator: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  divider: { height: 1, marginVertical: 12, opacity: 0.1, backgroundColor: '#000' },
  contactInfo: { gap: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13 },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  empty: { padding: 40, alignItems: 'center' }
});
