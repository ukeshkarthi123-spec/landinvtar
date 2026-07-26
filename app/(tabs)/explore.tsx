import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, RefreshControl,
  Dimensions, Image, Platform, StatusBar, Animated, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Search,
  Bell,
  Mic,
  Heart,
  MapPin,
  TrendingUp,
  Users,
  Star,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Clock,
  ArrowUpRight,
  X,
  MicOff
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import type { LandProject } from '@/types/database';
import PropertyCard from '@/components/PropertyCard';

const { width } = Dimensions.get('window');

type Category = 'All' | 'Residential' | 'Commercial' | 'Farm Land' | 'Industrial' | 'Luxury';
const categories: Category[] = ['All', 'Residential', 'Commercial', 'Farm Land', 'Industrial', 'Luxury'];

const BANNER_DATA = [
  {
    id: '1',
    title: 'Start Investing from ₹500',
    subtitle: 'Secure your future with fractional land ownership.',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1000&auto=format&fit=crop',
    cta: 'Start Now'
  },
  {
    id: '2',
    title: 'Govt Approved Projects',
    subtitle: '100% verified documents and clear titles.',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1000&auto=format&fit=crop',
    cta: 'View List'
  },
  {
    id: '3',
    title: 'High ROI Opportunities',
    subtitle: 'Earn up to 25% annual appreciation.',
    image: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?q=80&w=1000&auto=format&fit=crop',
    cta: 'Explore'
  }
];

export default function ExploreScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useApp();
  const [projects, setProjects] = useState<LandProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Voice Search States (Currently Disabled)
  const [isListening, setIsListening] = useState(false);

  const isMounted = useRef(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(1)).current;
  const micScale = useRef(new Animated.Value(1)).current;

  const dynamicStyles = getDynamicStyles(colors, isDark);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);

      if (isMounted.current) {
        setUnreadCount(count || 0);
      }
    } catch (err) {
      console.error('[Explore] Fetch unread error:', err);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const toggleVoiceSearch = async () => {
    Alert.alert('Voice Search', 'Voice search is temporarily unavailable.');
  };

  const fetchProjects = async () => {
    try {
      const result = await withTimeout(
        Promise.resolve(supabase
          .from('land_projects')
          .select('*')
          .eq('is_active', true)),
        10000
      ) as any;

      if (!isMounted.current) return;

      const { data, error } = result;
      if (!error && data) {
        setProjects(data as LandProject[]);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      }
    } catch (err) {
      if (isMounted.current) {
        console.error('Error fetching projects:', err);
      }
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await fetchProjects();
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

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

  useEffect(() => {
    isMounted.current = true;
    loadAll();

    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(bannerAnim, { toValue: 0.8, duration: 300, useNativeDriver: true }),
        Animated.timing(bannerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      setBannerIndex(prev => (prev + 1) % BANNER_DATA.length);
    }, 6000);

    return () => {
      isMounted.current = false;
      clearInterval(timer);
    };
  }, [loadAll]);

  const filtered = projects.filter(p => {
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory || p.category.includes(selectedCategory);

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchCat;

    const matchSearch =
      p.name.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.state?.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.expected_roi?.toString().includes(q) ||
      p.risk_score?.toLowerCase().includes(q);

    return matchCat && matchSearch;
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Premium Header */}
      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.headerInfo}>
          <Text style={dynamicStyles.greetingText}>{getGreeting()}, {profile?.name?.split(' ')[0] || 'Investor'}</Text>
          <Text style={dynamicStyles.headerTitle}>Explore Investments</Text>
        </View>
        <View style={dynamicStyles.headerActions}>
          <TouchableOpacity
            style={dynamicStyles.iconButton}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Bell size={22} color={colors.textPrimary} />
            {unreadCount > 0 && <View style={dynamicStyles.notificationDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.profileAvatar} onPress={() => router.push('/profile')}>
            <Image
              source={{ uri: profile?.avatar_url || 'https://ui-avatars.com/api/?background=00E38C&color=fff&name=' + (profile?.name || 'User') }}
              style={dynamicStyles.avatarImage}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modern Search Bar */}
      <View style={dynamicStyles.searchContainer}>
        <View style={[dynamicStyles.searchBar, isListening && dynamicStyles.searchBarListening]}>
          <Search size={20} color={isListening ? colors.emerald : colors.textMuted} />
          <TextInput
            style={dynamicStyles.searchInput}
            placeholder={isListening ? "Listening..." : "Search premium properties..."}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
             <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <X size={18} color={colors.textMuted} />
             </TouchableOpacity>
          )}
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              style={[dynamicStyles.micBtn, isListening && dynamicStyles.micBtnActive]}
              onPress={toggleVoiceSearch}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ scale: isListening ? micScale : 1 }] }}>
                  {isListening ? <MicOff size={20} color="#fff" /> : <Mic size={20} color={colors.emerald} />}
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
        }
      >
        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={dynamicStyles.filterList}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                dynamicStyles.filterChip,
                selectedCategory === cat && dynamicStyles.filterChipActive
              ]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.8}
            >
              {selectedCategory === cat ? (
                <LinearGradient
                  colors={colors.gradientGreen}
                  style={dynamicStyles.chipGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={dynamicStyles.filterChipTextActive}>{cat}</Text>
                </LinearGradient>
              ) : (
                <Text style={dynamicStyles.filterChipText}>{cat}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured Banner */}
        {!searchQuery && (
            <View style={dynamicStyles.bannerContainer}>
            <Animated.View style={[dynamicStyles.bannerCard, { transform: [{ scale: bannerAnim }] }]}>
                <Image source={{ uri: BANNER_DATA[bannerIndex].image }} style={dynamicStyles.bannerImage} />
                <LinearGradient
                colors={isDark ? ['rgba(0,0,0,0.2)', 'rgba(15, 17, 21, 0.9)'] : ['rgba(0,0,0,0.1)', 'rgba(255, 255, 255, 0.9)']}
                style={dynamicStyles.bannerGradient}
                />
                <View style={dynamicStyles.bannerContent}>
                <View style={dynamicStyles.bannerBadge}>
                    <TrendingUp size={12} color={colors.emerald} />
                    <Text style={dynamicStyles.bannerBadgeText}>FEATURED</Text>
                </View>
                <Text style={[dynamicStyles.bannerTitle, { color: isDark ? '#fff' : colors.textPrimary }]}>{BANNER_DATA[bannerIndex].title}</Text>
                <Text style={[dynamicStyles.bannerSub, { color: isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>{BANNER_DATA[bannerIndex].subtitle}</Text>
                <TouchableOpacity style={dynamicStyles.bannerCta}>
                    <Text style={dynamicStyles.bannerCtaText}>{BANNER_DATA[bannerIndex].cta}</Text>
                </TouchableOpacity>
                </View>

                <View style={dynamicStyles.bannerDots}>
                {BANNER_DATA.map((_, i) => (
                    <View key={i} style={[dynamicStyles.dot, bannerIndex === i && dynamicStyles.dotActive]} />
                ))}
                </View>
            </Animated.View>
            </View>
        )}

        {/* Results Info */}
        <View style={dynamicStyles.resultsInfo}>
          <Text style={dynamicStyles.resultsTitle}>
              {searchQuery ? `Results for "${searchQuery}"` : "Trending Opportunities"}
          </Text>
          <TouchableOpacity style={dynamicStyles.sortButton}>
            <Text style={dynamicStyles.sortText}>Sort By</Text>
            <Clock size={14} color={colors.emerald} />
          </TouchableOpacity>
        </View>

        {/* Project List */}
        {loading ? (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator color={colors.emerald} size="large" />
            <Text style={dynamicStyles.loadingText}>Curating investments...</Text>
          </View>
        ) : (
          <View style={dynamicStyles.projectList}>
            {filtered.map(project => (
                <PropertyCard
                    key={project.id}
                    project={project}
                    onPress={() => router.push(`/property/${project.id}` as any)}
                />
            ))}
            {filtered.length === 0 && (
              <View style={dynamicStyles.emptyState}>
                <View style={dynamicStyles.emptyIconBox}>
                  <Search size={40} color={colors.textMuted} />
                </View>
                <Text style={dynamicStyles.emptyTitle}>No matching properties</Text>
                <Text style={dynamicStyles.emptySub}>Try adjusting your filters or searching for another city.</Text>
                <TouchableOpacity
                    onPress={() => {setSearchQuery(''); setSelectedCategory('All');}}
                    style={dynamicStyles.clearSearchBtn}
                >
                    <Text style={dynamicStyles.clearSearchText}>Clear all filters</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

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
    searchContainer: { paddingHorizontal: 24, paddingBottom: 20 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
      borderRadius: 24, paddingHorizontal: 20, height: 56, borderWidth: 1, borderColor: colors.border, gap: 12,
    },
    searchBarListening: { borderColor: colors.emerald, backgroundColor: isDark ? '#121F1B' : colors.emeraldGlow },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '500' },
    micBtn: { padding: 8, backgroundColor: colors.emerald + '1a', borderRadius: 12 },
    micBtnActive: { backgroundColor: colors.emerald },
    filterList: { paddingHorizontal: 24, gap: 12, paddingBottom: 24 },
    filterChip: {
      height: 40, backgroundColor: colors.bgCard, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border, justifyContent: 'center', overflow: 'hidden',
    },
    filterChipActive: { borderColor: 'transparent' },
    chipGradient: { paddingHorizontal: 20, height: '100%', justifyContent: 'center' },
    filterChipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', paddingHorizontal: 20 },
    filterChipTextActive: { color: '#000', fontSize: 14, fontWeight: '700' },
    bannerContainer: { paddingHorizontal: 24, marginBottom: 32 },
    bannerCard: { height: 180, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, position: 'relative', backgroundColor: colors.bgCard },
    bannerImage: { width: '100%', height: '100%', position: 'absolute', opacity: 0.6 },
    bannerGradient: { ...StyleSheet.absoluteFillObject },
    bannerContent: { padding: 24, justifyContent: 'center', height: '100%' },
    bannerBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.emerald + '33',
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12,
    },
    bannerBadgeText: { color: colors.emerald, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    bannerTitle: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
    bannerSub: { fontSize: 13, marginBottom: 16, maxWidth: '70%' },
    bannerCta: { backgroundColor: colors.emerald, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start' },
    bannerCtaText: { color: '#000', fontSize: 12, fontWeight: '800' },
    bannerDots: { position: 'absolute', bottom: 20, right: 24, flexDirection: 'row', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' },
    dotActive: { width: 18, backgroundColor: colors.emerald },
    resultsInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
    resultsTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
    sortButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgCard,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    },
    sortText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    loadingContainer: { alignItems: 'center', paddingVertical: 100, gap: 16 },
    loadingText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
    projectList: { paddingHorizontal: 24 },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyIconBox: {
      width: 80, height: 80, borderRadius: 30, backgroundColor: colors.bgCard,
      alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.border,
    },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', maxWidth: '80%' },
    clearSearchBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.emerald + '1a', borderWidth: 1, borderColor: colors.emerald + '4d' },
    clearSearchText: { color: colors.emerald, fontWeight: '700', fontSize: 14 }
  });
}
