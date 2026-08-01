import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, ActivityIndicator, RefreshControl,
  Image, Platform, StatusBar, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Bell, TrendingUp, Wallet, Search, BarChart2, Map, Sparkles,
  ChevronRight, ArrowUpRight, TreePine, Building2,
  Factory, Home as HomeIcon, Smartphone, CreditCard, Award,
  ArrowRight
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import type { LandProject, Investment } from '@/types/database';
import { computePortfolioStats } from '@/types/database';
import PropertyCard from '@/components/PropertyCard';

const { width } = Dimensions.get('window');

function getGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good Morning';
  if (hr < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { profile, refreshProfile } = useApp();
  const [trendingProjects, setTrendingProjects] = useState<LandProject[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isMounted = useRef(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const dynamicStyles = getDynamicStyles(colors, isDark);

  const fetchData = async () => {
    try {
      const [projectsRes, investmentsRes, notifRes] = await Promise.all([
        withTimeout(
          Promise.resolve(supabase.from('land_projects').select('*').eq('is_active', true).order('investors_count', { ascending: false }).limit(4)),
          10000
        ),
        withTimeout(
          Promise.resolve(supabase.from('investments').select('id, amount, roi_rate, created_at')),
          10000
        ),
        withTimeout(
          Promise.resolve(supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false)),
          10000
        ),
      ]);

      if (!isMounted.current) return;

      if (projectsRes.data) setTrendingProjects(projectsRes.data as LandProject[]);
      if (investmentsRes.data) setInvestments(investmentsRes.data as Investment[]);
      if (notifRes.count !== null) setUnreadCount(notifRes.count);

      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    } catch (err) {
      console.error('[Home] Fetch error:', err);
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchData(), refreshProfile()]);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [refreshProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  }, [loadAll]);

  useEffect(() => {
    isMounted.current = true;
    loadAll();

    // Live updates for trending projects
    // We use a unique channel ID per mount to avoid "callback after subscribe" errors
    const channelId = `home-projects-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'land_projects' }, (payload) => {
        if (!isMounted.current) return;
        setTrendingProjects(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
      })
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const stats = useMemo(() => computePortfolioStats(investments), [investments]);

  const walletBalance = profile?.wallet_balance ?? 0;

  return (
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Premium Header */}
      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.headerInfo}>
          <Text style={dynamicStyles.greetingText}>{getGreeting()}, {profile?.name?.split(' ')[0] || 'Investor'}</Text>
          <Text style={dynamicStyles.headerTitle}>InvestLand Dashboard</Text>
        </View>
        <View style={dynamicStyles.headerActions}>
          <TouchableOpacity style={dynamicStyles.iconButton} onPress={() => router.push('/notifications')}>
            <Bell size={22} color={colors.textPrimary} />
            {unreadCount > 0 && <View style={dynamicStyles.notificationDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.profileAvatar} onPress={() => router.push('/profile')}>
            <Image
              source={{ uri: profile?.avatar_url || profile?.avatar || 'https://ui-avatars.com/api/?background=00E38C&color=fff&name=' + (profile?.name || 'User') }}
              style={dynamicStyles.avatarImage}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicStyles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Portfolio Premium Card */}
          <LinearGradient
            colors={isDark ? ['#161B22', '#0F1115'] : ['#FFFFFF', '#F8FAFC']}
            style={dynamicStyles.portfolioCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={dynamicStyles.portfolioHeader}>
              <View>
                <Text style={dynamicStyles.portfolioLabel}>Net Portfolio Value</Text>
                <Text style={dynamicStyles.portfolioValue}>₹{stats.portfolioValue.toLocaleString('en-IN')}</Text>
              </View>
              <View style={dynamicStyles.growthBadge}>
                <TrendingUp size={12} color={colors.emerald} />
                <Text style={dynamicStyles.growthText}>+{stats.returnsPercent.toFixed(1)}%</Text>
              </View>
            </View>

            <View style={dynamicStyles.statsRow}>
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statLabel}>Total Invested</Text>
                <Text style={dynamicStyles.statVal}>₹{stats.totalInvested.toLocaleString('en-IN')}</Text>
              </View>
              <View style={dynamicStyles.statDivider} />
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statLabel}>Total Returns</Text>
                <Text style={[dynamicStyles.statVal, { color: colors.emerald }]}>+₹{stats.totalReturns.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            <TouchableOpacity style={dynamicStyles.viewPortfolioBtn} onPress={() => router.push('/(tabs)/portfolio')}>
              <Text style={dynamicStyles.viewPortfolioText}>View detailed portfolio</Text>
              <ArrowRight size={14} color={colors.emerald} />
            </TouchableOpacity>
          </LinearGradient>

          {/* Quick Stats Grid */}
          <View style={dynamicStyles.quickStatsGrid}>
            <TouchableOpacity style={dynamicStyles.quickStatBox} onPress={() => router.push('/(tabs)/wallet')}>
              <View style={[dynamicStyles.quickIconBox, { backgroundColor: colors.emerald + '1a' }]}>
                <Wallet size={20} color={colors.emerald} />
              </View>
              <Text style={dynamicStyles.quickLabel}>Wallet</Text>
              <Text style={dynamicStyles.quickValue}>₹{walletBalance.toLocaleString('en-IN')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={dynamicStyles.quickStatBox} onPress={() => router.push('/(tabs)/explore')}>
              <View style={[dynamicStyles.quickIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <TrendingUp size={20} color="#3B82F6" />
              </View>
              <Text style={dynamicStyles.quickLabel}>Market</Text>
              <Text style={dynamicStyles.quickValue}>Growing</Text>
            </TouchableOpacity>
          </View>

          {/* Section: Top Opportunities */}
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>High ROI Opportunities</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={dynamicStyles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.emerald} style={{ marginVertical: 20 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dynamicStyles.horizontalScroll}>
              {trendingProjects.map(project => (
                <PropertyCard
                  key={project.id}
                  project={project}
                  onPress={() => router.push(`/property/${project.id}` as any)}
                  horizontal
                />
              ))}
            </ScrollView>
          )}

          {/* Market Insights Banner */}
          <LinearGradient
            colors={isDark ? ['#1C222B', '#161B22'] : ['#F1F5F9', '#FFFFFF']}
            style={dynamicStyles.insightBanner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={dynamicStyles.insightContent}>
              <View style={dynamicStyles.insightIconBox}>
                <Sparkles size={24} color={colors.emerald} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.insightTitle}>Market appreciation at peak!</Text>
                <Text style={dynamicStyles.insightDesc}>Land prices in ECR region rose by 12% last quarter. Check new listings.</Text>
              </View>
            </View>
            <TouchableOpacity style={dynamicStyles.insightCTA} onPress={() => router.push('/(tabs)/explore')}>
              <Text style={dynamicStyles.insightCTAText}>Explore Now</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Section: Categories */}
          <Text style={[dynamicStyles.sectionTitle, { marginLeft: 24, marginBottom: 16 }]}>Explore by Category</Text>
          <View style={dynamicStyles.categoriesGrid}>
            {[
              { label: 'Residential', icon: <HomeIcon size={20} color={colors.emerald} />, color: colors.emerald + '1a' },
              { label: 'Commercial', icon: <Building2 size={20} color="#3B82F6" />, color: 'rgba(59, 130, 246, 0.1)' },
              { label: 'Farm Land', icon: <TreePine size={20} color="#FBBF24" />, color: 'rgba(251, 191, 36, 0.1)' },
              { label: 'Industrial', icon: <Factory size={20} color="#A78BFA" />, color: 'rgba(167, 139, 250, 0.1)' },
            ].map(cat => (
              <TouchableOpacity key={cat.label} style={dynamicStyles.categoryCard} onPress={() => router.push('/(tabs)/explore')}>
                <View style={[dynamicStyles.categoryIcon, { backgroundColor: cat.color }]}>{cat.icon}</View>
                <Text style={dynamicStyles.categoryLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20,
    },
    headerInfo: { flex: 1 },
    greetingText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: 4 },
    headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    iconButton: {
      width: 44, height: 44, borderRadius: 14, backgroundColor: colors.bgCard,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    notificationDot: {
      position: 'absolute', top: 12, right: 12, width: 8, height: 8,
      borderRadius: 4, backgroundColor: colors.emerald, borderWidth: 2, borderColor: colors.bgCard,
    },
    profileAvatar: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.emerald, padding: 2 },
    avatarImage: { width: '100%', height: '100%', borderRadius: 12 },
    scrollContent: { paddingTop: 10 },
    portfolioCard: {
      marginHorizontal: 24, padding: 24, borderRadius: 28, borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20,
    },
    portfolioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    portfolioLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    portfolioValue: { color: colors.textPrimary, fontSize: 32, fontWeight: '900', marginTop: 4 },
    growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.emerald + '1a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    growthText: { color: colors.emerald, fontSize: 12, fontWeight: '800' },
    statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    statItem: { flex: 1 },
    statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 },
    statVal: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
    statDivider: { width: 1, height: 30, backgroundColor: colors.border, marginHorizontal: 20 },
    viewPortfolioBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
    viewPortfolioText: { color: colors.emerald, fontSize: 13, fontWeight: '700' },
    quickStatsGrid: { flexDirection: 'row', gap: 16, paddingHorizontal: 24, marginTop: 24 },
    quickStatBox: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.border },
    quickIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    quickLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    quickValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginTop: 32, marginBottom: 16 },
    sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
    seeAllText: { color: colors.emerald, fontSize: 13, fontWeight: '700' },
    horizontalScroll: { paddingLeft: 24, paddingRight: 10 },
    insightBanner: { marginHorizontal: 24, marginTop: 16, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border },
    insightContent: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 16 },
    insightIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.emerald + '1a', alignItems: 'center', justifyContent: 'center' },
    insightTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
    insightDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
    insightCTA: { backgroundColor: colors.emerald, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    insightCTAText: { color: '#000', fontSize: 13, fontWeight: '800' },
    categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 24 },
    categoryCard: { width: (width - 60) / 2, backgroundColor: colors.bgCard, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border },
    categoryIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    categoryLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  });
}
