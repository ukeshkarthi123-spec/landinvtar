import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, StatusBar, Platform, Animated } from 'react-native';
import { router } from 'expo-router';
import {
    Users, Landmark, Wallet, ShieldCheck, PieChart, Bell,
    ArrowRight, Settings, LogOut, ArrowLeft, TrendingUp, Sparkles,
    HeadphonesIcon, ChevronRight
} from 'lucide-react-native';
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
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
        revenue: totalInvested * 0.02
      });

      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const StatCard = ({ title, value, icon: Icon, color, route }: any) => (
    <TouchableOpacity
      style={styles.statCard}
      onPress={() => router.push(route)}
    >
      <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
        <Icon size={24} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{title}</Text>
      </View>
      <View style={styles.arrowBox}>
        <ArrowRight size={14} color="#666" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)')}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Admin Console</Text>
            <Text style={styles.headerSub}>Platform performance at a glance</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={signOut}>
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchStats} tintColor="#00E38C" />}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
            {/* Revenue Premium Card */}
            <LinearGradient colors={['#161B22', '#0F1115']} style={styles.revenueCard}>
                <View style={styles.revHeader}>
                    <Sparkles size={20} color="#00E38C" />
                    <Text style={styles.revLabel}>ESTIMATED PLATFORM REVENUE</Text>
                </View>
                <Text style={styles.revValue}>₹{stats.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                <View style={styles.revFooter}>
                    <TrendingUp size={14} color="#00E38C" />
                    <Text style={styles.revTrend}>2% service fee on ₹{(stats.investments/100000).toFixed(2)}L</Text>
                </View>
            </LinearGradient>

            <View style={styles.statsGrid}>
                <View style={styles.statsRow}>
                    <StatCard title="Total Investors" value={stats.users} icon={Users} color="#3B82F6" route="/admin/users" />
                    <StatCard title="Listed Projects" value={stats.properties} icon={Landmark} color="#00E38C" route="/admin/properties" />
                </View>
                <View style={[styles.statsRow, { marginTop: 12 }]}>
                    <StatCard title="Total AUM" value={`₹${(stats.investments/100000).toFixed(1)}L`} icon={Wallet} color="#FBBF24" route="/admin/investments" />
                    <StatCard title="KYC Requests" value={stats.pendingKyc} icon={ShieldCheck} color="#EF4444" route="/admin/kyc" />
                </View>
            </View>

            <Text style={styles.sectionTitle}>Management Tools</Text>

            <View style={styles.toolsCard}>
                {[
                    { label: 'Project Inventory', icon: Landmark, color: '#00E38C', route: '/admin/properties' },
                    { label: 'KYC Verification', icon: ShieldCheck, color: '#EF4444', route: '/admin/kyc' },
                    { label: 'Investment Audit', icon: Wallet, color: '#FBBF24', route: '/admin/investments' },
                    { label: 'User Directory', icon: Users, color: '#3B82F6', route: '/admin/users' },
                    { label: 'Support Tickets', icon: HeadphonesIcon, color: '#A78BFA', route: '/admin/support' },
                ].map((tool, i) => (
                    <TouchableOpacity
                        key={i}
                        style={styles.toolItem}
                        onPress={() => router.push(tool.route as any)}
                    >
                        <View style={[styles.toolIcon, { backgroundColor: tool.color + '10' }]}>
                            <tool.icon size={20} color={tool.color} />
                        </View>
                        <Text style={styles.toolLabel}>{tool.label}</Text>
                        <ChevronRight size={16} color="#444" />
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>InvestLand Infrastructure v1.0.2</Text>
                <Text style={styles.footerSub}>System status: Operational</Text>
            </View>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20,
  },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#161B22', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2D333B' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#666', fontSize: 12, fontWeight: '600', marginTop: 1 },
  iconButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#161B22', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2D333B' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 10 },
  revenueCard: { padding: 24, borderRadius: 28, borderWidth: 1, borderColor: '#2D333B', marginBottom: 24 },
  revHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  revLabel: { color: '#A0A0A0', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  revValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  revFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#2D333B' },
  revTrend: { color: '#00E38C', fontSize: 12, fontWeight: '700' },
  statsGrid: { marginBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: '#161B22', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#2D333B', alignItems: 'center', gap: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  statLabel: { color: '#666', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  arrowBox: { position: 'absolute', top: 12, right: 12 },
  sectionTitle: { color: '#A0A0A0', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  toolsCard: { backgroundColor: '#161B22', borderRadius: 24, borderWidth: 1, borderColor: '#2D333B', overflow: 'hidden' },
  toolItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16, borderBottomWidth: 1, borderBottomColor: '#2D333B' },
  toolIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1 },
  footer: { marginTop: 40, alignItems: 'center', gap: 4 },
  footerText: { color: '#444', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  footerSub: { color: '#222', fontSize: 10, fontWeight: '700' },
});
