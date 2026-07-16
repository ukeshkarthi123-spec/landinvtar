import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, ActivityIndicator, RefreshControl,
  Image, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import {
  Bell, TrendingUp, Wallet, Search, BarChart2, Map, Sparkles,
  ChevronRight, ArrowUpRight, TreePine, Building2,
  Factory, Home as HomeIcon,
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import type { LandProject, Investment } from '@/types/database';
import { computePortfolioStats } from '@/types/database';
import PropertyCard from '@/components/PropertyCard';
import QuickAction from '@/components/QuickAction';

const { width } = Dimensions.get('window');

function getGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good Morning';
  if (hr < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { profile, refreshProfile, isAuthenticated } = useApp();
  const [trendingProjects, setTrendingProjects] = useState<LandProject[]>([]);
  const [aiProjects, setAiProjects] = useState<LandProject[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const isMounted = useRef(true);
  const channelSubscribed = useRef(false);

  const categories = useMemo(() => [
    { label: 'Residential', icon: <HomeIcon size={20} color={colors.emerald} />, color: colors.emeraldGlow },
    { label: 'Commercial', icon: <Building2 size={20} color='#60A5FA' />, color: 'rgba(96,165,250,0.12)' },
    { label: 'Farm Land', icon: <TreePine size={20} color='#34D399' />, color: 'rgba(52,211,153,0.12)' },
    { label: 'Industrial', icon: <Factory size={20} color='#FBBF24' />, color: 'rgba(251,191,36,0.12)' },
  ], [colors.emerald, colors.emeraldGlow]);

  // Fetch data with timeout and error handling
  const fetchData = async () => {
    setLoadError(null);
    try {
      const [projectsRes, aiRes, investmentsRes, notifRes] = await Promise.all([
        withTimeout(
          Promise.resolve(supabase
            .from('land_projects')
            .select('*')
            .eq('is_active', true)
            .order('investors_count', { ascending: false })
            .limit(4)),
          10000
        ) as Promise<any>,
        withTimeout(
          Promise.resolve(supabase
            .from('land_projects')
            .select('*')
            .eq('is_active', true)
            .order('expected_roi', { ascending: false })
            .limit(3)),
          10000
        ) as Promise<any>,
        withTimeout(
          Promise.resolve(supabase
            .from('investments')
            .select('id, amount, roi_rate, created_at')),
          10000
        ) as Promise<any>,
        withTimeout(
          Promise.resolve(supabase
            .from('notifications')
            .select('id', { count: 'exact' })
            .eq('is_read', false)),
          10000
        ) as Promise<any>,
      ]);

      if (!isMounted.current) return;

      if (projectsRes.error) {
        setLoadError(projectsRes.error.message);
        return;
      }

      if (projectsRes.data) setTrendingProjects(projectsRes.data as LandProject[]);
      if (!aiRes.error && aiRes.data) setAiProjects(aiRes.data as LandProject[]);
      if (!investmentsRes.error && investmentsRes.data) setInvestments(investmentsRes.data as Investment[]);
      if (!notifRes.error) setUnreadCount(notifRes.count ?? 0);
    } catch (err: any) {
      if (isMounted.current) {
        console.error('Fetch error:', err);
        setLoadError(err?.message ?? 'Failed to load data');
      }
    }
  };

  const loadAll = useCallback(async () => {
    setDataLoading(true);
    try {
      await Promise.all([
        fetchData(),
        refreshProfile(),
      ]);
    } catch (err: any) {
      if (isMounted.current) {
        setLoadError(err?.message ?? 'Failed to load data');
      }
    } finally {
      if (isMounted.current) {
        setDataLoading(false);
      }
    }
  }, [refreshProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  }, [loadAll]);

  // Initial load on component mount
  useEffect(() => {
    isMounted.current = true;
    loadAll();

    return () => {
      isMounted.current = false;
    };
  }, [loadAll]);

  // Subscribe to live project updates (once)
  useEffect(() => {
    if (channelSubscribed.current) return;
    channelSubscribed.current = true;

    const channel = supabase
      .channel('public:land_projects')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'land_projects' },
        (payload) => {
          if (!isMounted.current) return;
          setTrendingProjects(current =>
            current.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
          );
          setAiProjects(current =>
            current.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelSubscribed.current = false;
    };
  }, []);

  // Use focus effect for pull-to-refresh only, not for auto-loading
  useFocusEffect(
    useCallback(() => {
      // Don't auto-refresh on focus, let user pull-to-refresh
      return () => {};
    }, [])
  );

  const stats = computePortfolioStats(investments);

  const formatINR = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${Math.round(val)}`;
  };

  const handleProfilePress = async () => {
    if (navigating) return;
    setNavigating(true);

    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      if (isAuthenticated) {
        router.push('/(tabs)/profile');
      } else {
        router.push('/login');
      }
    } catch (err) {
      console.error('Navigation error:', err);
    } finally {
      setTimeout(() => setNavigating(false), 800);
    }
  };

  const walletBalance = profile?.wallet_balance ?? 0;
  const name = profile?.name ?? 'Investor';
  const initials = name.trim() ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U';
  const profilePhoto = profile?.avatar;

  const gradientColors: [string, string] = isDark
    ? ['#0D1A13', colors.bg]
    : ['#FFFFFF', colors.bg];

  const portfolioGradientColors: [string, string, string] = isDark
    ? ['rgba(22,199,132,0.12)', 'rgba(14,159,110,0.06)', 'rgba(9,9,9,0)']
    : ['rgba(22,199,132,0.08)', 'rgba(14,159,110,0.04)', 'rgba(248,250,252,0)'];

  const dynamicStyles = getDynamicStyles(colors, isDark);
  const insightColors = [colors.emerald, '#60A5FA', colors.warning];

  return (
    <View style={dynamicStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicStyles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
      >
        {/* Top Bar */}
        <LinearGradient
          colors={gradientColors}
          style={dynamicStyles.topGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <View style={dynamicStyles.topBar}>
            <View>
              <Text style={dynamicStyles.greetingSmall}>{getGreeting()}</Text>
              <Text style={dynamicStyles.greetingName}>{name} 👋</Text>
            </View>
            <View style={dynamicStyles.topActions}>
              <TouchableOpacity
                style={dynamicStyles.iconBtn}
                onPress={() => router.push('/notifications')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Bell size={20} color={colors.textPrimary} />
                {unreadCount > 0 && (
                  <View style={dynamicStyles.notifBadge}>
                    <Text style={dynamicStyles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.avatarBtn}
                onPress={handleProfilePress}
                activeOpacity={0.7}
                disabled={navigating}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {profilePhoto && profilePhoto.startsWith('http') ? (
                  <Image
                    source={{ uri: profilePhoto }}
                    style={dynamicStyles.avatarImage}
                    onError={(e) => console.log('Avatar load error:', e.nativeEvent.error)}
                  />
                ) : (
                  <View style={dynamicStyles.avatarCircle}>
                    <Text style={dynamicStyles.avatarText}>{profilePhoto || initials}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Portfolio Summary Card */}
          <LinearGradient
            colors={portfolioGradientColors}
            style={dynamicStyles.portfolioCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={dynamicStyles.portfolioBorder}>
              <View style={dynamicStyles.portfolioTop}>
                <Text style={dynamicStyles.portfolioLabel}>Total Portfolio Value</Text>
                {stats.portfolioValue > 0 && (
                  <View style={dynamicStyles.growthChip}>
                    <TrendingUp size={12} color={colors.emerald} />
                    <Text style={dynamicStyles.growthChipText}>+{stats.todayGrowthPercent.toFixed(3)}% today</Text>
                  </View>
                )}
              </View>
              {dataLoading
                ? <ActivityIndicator color={colors.emerald} style={{ marginVertical: 10 }} />
                : <Text style={dynamicStyles.portfolioValue}>{formatINR(stats.portfolioValue)}</Text>
              }
              <View style={dynamicStyles.portfolioRow}>
                <View style={dynamicStyles.portfolioStat}>
                  <Text style={dynamicStyles.portfolioStatLabel}>Invested</Text>
                  <Text style={dynamicStyles.portfolioStatVal}>{formatINR(stats.totalInvested)}</Text>
                </View>
                <View style={dynamicStyles.portfolioStatDivider} />
                <View style={dynamicStyles.portfolioStat}>
                  <Text style={dynamicStyles.portfolioStatLabel}>Returns</Text>
                  <Text style={[dynamicStyles.portfolioStatVal, { color: colors.emerald }]}>
                    +{formatINR(stats.totalReturns)}
                  </Text>
                </View>
                <View style={dynamicStyles.portfolioStatDivider} />
                <View style={dynamicStyles.portfolioStat}>
                  <Text style={dynamicStyles.portfolioStatLabel}>Today</Text>
                  <Text style={[dynamicStyles.portfolioStatVal, { color: colors.emerald }]}>
                    +{formatINR(stats.todayGrowth)}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Wallet Balance */}
          <View style={dynamicStyles.walletRow}>
            <TouchableOpacity style={dynamicStyles.walletCard} onPress={() => router.push('/(tabs)/wallet')}>
              <Wallet size={16} color={colors.emerald} />
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.walletLabel}>Wallet Balance</Text>
                {dataLoading
                  ? <ActivityIndicator color={colors.textPrimary} size="small" />
                  : <Text style={dynamicStyles.walletValue}>₹{walletBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                }
              </View>
              <ChevronRight size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Quick Actions</Text>
          <View style={dynamicStyles.quickActionsRow}>
            <QuickAction icon={<TrendingUp size={22} color="#fff" />} label="Invest" onPress={() => router.push('/(tabs)/explore')} highlight />
            <QuickAction icon={<BarChart2 size={22} color={colors.emerald} />} label="Portfolio" onPress={() => router.push('/(tabs)/portfolio')} />
            <QuickAction icon={<Wallet size={22} color={colors.emerald} />} label="Wallet" onPress={() => router.push('/(tabs)/wallet')} />
            <QuickAction icon={<Map size={22} color={colors.emerald} />} label="Map View" onPress={() => router.push('/(tabs)/explore')} />
            <QuickAction icon={<Search size={22} color={colors.emerald} />} label="Search" onPress={() => router.push('/(tabs)/explore')} />
          </View>
        </View>

        {/* AI Suggestions */}
        <View style={dynamicStyles.section}>
          <View style={dynamicStyles.sectionHeader}>
            <View style={dynamicStyles.sectionTitleRow}>
              <Sparkles size={16} color={colors.emerald} />
              <Text style={dynamicStyles.sectionTitle}>AI Suggestions</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}><Text style={dynamicStyles.seeAll}>See All</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {aiProjects.map((p, idx) => {
              const titles = ['High ROI Opportunity', 'Top Performer', 'Trending Now'];
              const messages = [
                `${p.expected_roi}% expected ROI in ${p.category.toLowerCase()} — ${p.location}.`,
                `Strong appreciation potential with ${p.investors_count}+ investors already on board.`,
                `${p.funding_progress}% funded — limited allocation remaining for ${p.name}.`,
              ];
              const aiGradientColors: [string, string] = isDark
                ? ['rgba(22,199,132,0.1)', 'rgba(14,159,110,0.04)']
                : ['rgba(22,199,132,0.08)', 'rgba(14,159,110,0.02)'];
              return (
                <TouchableOpacity key={p.id} style={dynamicStyles.aiCard} activeOpacity={0.85} onPress={() => router.push(`/property/${p.id}` as any)}>
                  <LinearGradient colors={aiGradientColors} style={dynamicStyles.aiCardGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={dynamicStyles.aiChip}>
                      <Sparkles size={10} color={colors.emerald} />
                      <Text style={dynamicStyles.aiChipText}>AI Pick</Text>
                    </View>
                    <Text style={dynamicStyles.aiTitle}>{titles[idx] ?? 'Recommended'}</Text>
                    <Text style={dynamicStyles.aiMsg} numberOfLines={3}>{messages[idx] ?? `${p.name} — ${p.expected_roi}% ROI`}</Text>
                    <View style={dynamicStyles.aiProject}>
                      <Text style={dynamicStyles.aiProjectText}>{p.name}</Text>
                      <ArrowUpRight size={12} color={colors.emerald} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Categories */}
        <View style={dynamicStyles.section}>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>Categories</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={dynamicStyles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={dynamicStyles.categoriesGrid}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.label}
                style={[dynamicStyles.categoryCard, { backgroundColor: cat.color }]}
                activeOpacity={0.8}
                onPress={() => router.push('/(tabs)/explore')}
              >
                <View style={dynamicStyles.categoryIcon}>{cat.icon}</View>
                <Text style={dynamicStyles.categoryLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Trending Projects */}
        <View style={dynamicStyles.section}>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>Trending Projects</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={dynamicStyles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {dataLoading && <ActivityIndicator color={colors.emerald} style={{ marginVertical: 20 }} />}
          {!dataLoading && loadError && (
            <View style={dynamicStyles.errorBox}>
              <Text style={dynamicStyles.errorText}>{loadError}</Text>
              <TouchableOpacity onPress={loadAll} style={dynamicStyles.retryBtn}>
                <Text style={dynamicStyles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {!dataLoading && !loadError && trendingProjects.length === 0 && (
            <Text style={dynamicStyles.emptyText}>No projects available right now.</Text>
          )}
          {!dataLoading && !loadError && trendingProjects.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 24 }}>
              {trendingProjects.map(p => (
                <View key={p.id} style={{ width: width * 0.72 }}>
                  <PropertyCard project={p} onPress={() => router.push(`/property/${p.id}` as any)} horizontal />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Market Insights */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Market Insights</Text>
          <View style={dynamicStyles.insightCard}>
            {trendingProjects.slice(0, 3).map((p, i) => (
              <View key={p.id} style={dynamicStyles.insightRow}>
                <View style={[dynamicStyles.insightDot, { backgroundColor: insightColors[i] }]} />
                <Text style={dynamicStyles.insightText}>
                  {p.name} ({p.location}) — {p.funding_progress}% funded, {p.investors_count} investors, {p.expected_roi}% expected ROI
                </Text>
              </View>
            ))}
            {trendingProjects.length === 0 && (
              <View style={dynamicStyles.insightRow}>
                <View style={dynamicStyles.insightDot} />
                <Text style={dynamicStyles.insightText}>Loading market data...</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 20 },
    topGradient: { paddingBottom: 8 },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
    greetingSmall: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
    greetingName: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginTop: 2 },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, position: 'relative' },
    notifBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: colors.error, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    avatarBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
    avatarImage: { width: 40, height: 40, borderRadius: 20 },
    avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    portfolioCard: { marginHorizontal: 20, borderRadius: 20, marginBottom: 12 },
    portfolioBorder: { borderRadius: 20, borderWidth: 1, borderColor: colors.emerald + '22', padding: 18 },
    portfolioTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    portfolioLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
    growthChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.emeraldGlow, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.emerald + '33' },
    growthChipText: { color: colors.emerald, fontSize: 11, fontWeight: '700' },
    portfolioValue: { color: colors.textPrimary, fontSize: 36, fontWeight: '900', letterSpacing: -1, marginBottom: 16 },
    portfolioRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glass, borderRadius: 12, padding: 12 },
    portfolioStat: { flex: 1, alignItems: 'center', gap: 3 },
    portfolioStatDivider: { width: 1, height: 28, backgroundColor: colors.glassBorder },
    portfolioStatLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '500', textTransform: 'uppercase' },
    portfolioStatVal: { color: colors.textPrimary, fontSize: 14, fontWeight: '800' },
    walletRow: { paddingHorizontal: 20, marginTop: 4 },
    walletCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
    walletLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
    walletValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 1 },
    section: { paddingHorizontal: 20, marginTop: 24 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 14 },
    seeAll: { color: colors.emerald, fontSize: 12, fontWeight: '700' },
    quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    aiCard: { width: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder },
    aiCardGrad: { padding: 14 },
    aiChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.emeraldGlow, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 10 },
    aiChipText: { color: colors.emerald, fontSize: 9, fontWeight: '700' },
    aiTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 6 },
    aiMsg: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginBottom: 10 },
    aiProject: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    aiProjectText: { color: colors.emerald, fontSize: 11, fontWeight: '600' },
    categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    categoryCard: { width: (width - 50) / 2, borderRadius: 16, padding: 16, alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: colors.glassBorder },
    categoryIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
    categoryLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
    insightCard: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border },
    insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    insightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.emerald, marginTop: 6 },
    insightText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, flex: 1 },
    errorBox: { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.error + '33', gap: 10 },
    errorText: { color: colors.error, fontSize: 13, lineHeight: 18 },
    retryBtn: { alignSelf: 'flex-start', backgroundColor: colors.emeraldGlow, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    retryBtnText: { color: colors.emerald, fontSize: 12, fontWeight: '700' },
    emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginVertical: 20 },
  });
}
