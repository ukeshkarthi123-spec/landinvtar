import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Users, Landmark, Wallet, ShieldCheck, PieChart, Bell, ArrowRight, Settings, LogOut } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '@/context/AppContext';

export default function AdminDashboard() {
  const { colors, isDark } = useTheme();
  const { signOut } = useApp();
  const [stats, setStats] = useState({
    users: 0,
    investments: 0,
    properties: 0,
    pendingKyc: 0,
    revenue: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [u, i, p, k] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('investments').select('amount'),
        supabase.from('land_projects').select('id', { count: 'exact', head: true }),
        supabase.from('kyc_documents').select('id', { count: 'exact', head: true }).eq('status', 'Pending')
      ]);

      const totalInvested = (i.data ?? []).reduce((sum, item) => sum + (item.amount || 0), 0);

      setStats({
        users: u.count || 0,
        investments: totalInvested,
        properties: p.count || 0,
        pendingKyc: k.count || 0,
        revenue: totalInvested * 0.02 // Example 2% platform fee
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const StatCard = ({ title, value, icon: Icon, color, route }: any) => (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      onPress={() => router.push(route)}
    >
      <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
        <Icon size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{title}</Text>
      </View>
      <ArrowRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topBar, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.welcome, { color: colors.textPrimary }]}>InvestLand Admin</Text>
          <Text style={[styles.subDate, { color: colors.textMuted }]}>
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <LogOut size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchStats} tintColor={colors.emerald} />}
      >
        <View style={styles.grid}>
          <StatCard title="Total Users" value={stats.users} icon={Users} color="#3B82F6" route="/admin/users" />
          <StatCard title="Active Land" value={stats.properties} icon={Landmark} color={colors.emerald} route="/admin/properties" />
          <StatCard title="Total Invested" value={`₹${(stats.investments/100000).toFixed(1)}L`} icon={Wallet} color="#F59E0B" route="/admin/investments" />
          <StatCard title="Pending KYC" value={stats.pendingKyc} icon={ShieldCheck} color="#EF4444" route="/admin/kyc" />
        </View>

        <TouchableOpacity style={styles.revenueCard} activeOpacity={0.9}>
          <LinearGradient colors={colors.gradientGreen} style={styles.revenueGrad} start={{x:0, y:0}} end={{x:1, y:0}}>
            <View>
              <Text style={styles.revLabel}>Estimated Revenue (2%)</Text>
              <Text style={styles.revValue}>₹{stats.revenue.toLocaleString('en-IN')}</Text>
            </View>
            <PieChart size={40} color="rgba(255,255,255,0.5)" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.quickActions}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[styles.actionIcon, { backgroundColor: colors.emeraldGlow }]}>
                <Bell size={20} color={colors.emerald} />
              </View>
              <Text style={[styles.actionText, { color: colors.textPrimary }]}>Broadcast</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => router.push('/admin/properties')}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(96,165,250,0.1)' }]}>
                <Landmark size={20} color="#3B82F6" />
              </View>
              <Text style={[styles.actionText, { color: colors.textPrimary }]}>New Land</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.actionRow, { marginTop: 12 }]}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => router.push('/admin/kyc')}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <ShieldCheck size={20} color="#EF4444" />
              </View>
              <Text style={[styles.actionText, { color: colors.textPrimary }]}>Verify KYC</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                <Settings size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.actionText, { color: colors.textPrimary }]}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>InvestLand v1.0.0 Admin</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { padding: 20 },
  welcome: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subDate: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  grid: { gap: 12 },
  statCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, gap: 15 },
  iconBox: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statContent: { flex: 1 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 13, fontWeight: '600' },
  revenueCard: { marginTop: 20, borderRadius: 24, overflow: 'hidden', elevation: 4 },
  revenueGrad: { padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  revValue: { color: '#FFF', fontSize: 32, fontWeight: '800', marginTop: 4 },
  quickActions: { marginTop: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15 },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '700' },
  footer: { marginTop: 40, marginBottom: 40, alignItems: 'center' },
  footerText: { fontSize: 12, fontWeight: '500' }
});
