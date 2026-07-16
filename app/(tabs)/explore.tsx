import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import type { LandProject } from '@/types/database';
import PropertyCard from '@/components/PropertyCard';

type Category = 'All' | 'Residential' | 'Commercial' | 'Farm Land' | 'Industrial' | 'Luxury Villas';
const categories: Category[] = ['All', 'Residential', 'Commercial', 'Farm Land', 'Industrial', 'Luxury Villas'];
const sortOptions = ['Trending', 'High ROI', 'Low Risk', 'Min Investment', 'Most Funded'];

export default function ExploreScreen() {
  const { colors, isDark } = useTheme();
  const [projects, setProjects] = useState<LandProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [selectedSort, setSelectedSort] = useState('Trending');
  const [showFilters, setShowFilters] = useState(false);

  const isMounted = useRef(true);
  const channelSubscribed = useRef(false);

  // Fetch projects with timeout
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

    return () => {
      isMounted.current = false;
    };
  }, [loadAll]);

  // Subscribe to live project updates (once)
  useEffect(() => {
    if (channelSubscribed.current) return;
    channelSubscribed.current = true;

    const channel = supabase
      .channel('explore:land_projects')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'land_projects' },
        (payload) => {
          if (!isMounted.current) return;
          setProjects(current =>
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

  const filtered = projects.filter(p => {
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q) || p.city.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (selectedSort === 'High ROI') return b.expected_roi - a.expected_roi;
    if (selectedSort === 'Low Risk') {
      const rv = { Low: 0, Medium: 1, High: 2 };
      return rv[a.risk_score] - rv[b.risk_score];
    }
    if (selectedSort === 'Min Investment') return a.min_investment - b.min_investment;
    if (selectedSort === 'Most Funded') return b.funding_progress - a.funding_progress;
    return b.investors_count - a.investors_count;
  });

  const headerGradientColors: [string, string] = isDark
    ? ['#0D1A13', colors.bg]
    : ['#FFFFFF', colors.bg];

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <LinearGradient colors={headerGradientColors} style={dynamicStyles.header} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
        <View style={dynamicStyles.headerTop}>
          <Text style={dynamicStyles.headerTitle}>Land Marketplace</Text>
          <TouchableOpacity
            style={[dynamicStyles.filterBtn, showFilters && dynamicStyles.filterBtnActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={18} color={showFilters ? colors.emerald : colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.searchBar}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={dynamicStyles.searchInput}
            placeholder="Search projects, locations, cities..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
      >
        {/* Categories — sticky */}
        <View style={dynamicStyles.stickySection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dynamicStyles.categoryList}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[dynamicStyles.categoryChip, selectedCategory === cat && dynamicStyles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.8}
              >
                {selectedCategory === cat ? (
                  <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.categoryChipGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={dynamicStyles.categoryChipTextActive}>{cat}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={dynamicStyles.categoryChipText}>{cat}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Filter Panel */}
        {showFilters && (
          <View style={dynamicStyles.filterPanel}>
            <Text style={dynamicStyles.filterLabel}>Sort By</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {sortOptions.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[dynamicStyles.sortChip, selectedSort === opt && dynamicStyles.sortChipActive]}
                  onPress={() => setSelectedSort(opt)}
                >
                  <Text style={[dynamicStyles.sortChipText, selectedSort === opt && dynamicStyles.sortChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Results header */}
        <View style={dynamicStyles.resultsHeader}>
          <Text style={dynamicStyles.resultsCount}>{sorted.length} Projects Found</Text>
          <Text style={dynamicStyles.sortedBy}>Sorted by: {selectedSort}</Text>
        </View>

        {/* Loading */}
        {loading && (
          <View style={dynamicStyles.centered}>
            <ActivityIndicator color={colors.emerald} size="large" />
            <Text style={dynamicStyles.loadingText}>Loading projects...</Text>
          </View>
        )}

        {/* Project List */}
        {!loading && (
          <View style={dynamicStyles.projectList}>
            {sorted.map(project => (
              <PropertyCard
                key={project.id}
                project={project}
                onPress={() => router.push(`/property/${project.id}` as any)}
              />
            ))}
            {sorted.length === 0 && (
              <View style={dynamicStyles.emptyState}>
                <Text style={dynamicStyles.emptyTitle}>No Projects Found</Text>
                <Text style={dynamicStyles.emptySub}>Try adjusting your filters or search query</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    filterBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    filterBtnActive: { borderColor: colors.emerald + '55', backgroundColor: colors.emeraldGlow },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgInput, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12 },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
    stickySection: { backgroundColor: colors.bg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    categoryList: { paddingHorizontal: 20, gap: 8 },
    categoryChip: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, overflow: 'hidden' },
    categoryChipActive: { borderColor: colors.emerald + '55' },
    categoryChipGrad: { paddingHorizontal: 14, paddingVertical: 7 },
    categoryChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 7 },
    categoryChipTextActive: { color: '#fff', fontSize: 13, fontWeight: '600' },
    filterPanel: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border },
    filterLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    sortChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
    sortChipActive: { borderColor: colors.emerald, backgroundColor: colors.emeraldGlow },
    sortChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    sortChipTextActive: { color: colors.emerald },
    resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
    resultsCount: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    sortedBy: { color: colors.textMuted, fontSize: 12 },
    centered: { alignItems: 'center', paddingVertical: 48 },
    loadingText: { color: colors.textMuted, fontSize: 13, marginTop: 12 },
    projectList: { paddingHorizontal: 20, paddingBottom: 20 },
    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    emptySub: { color: colors.textMuted, fontSize: 14 },
  });
}
