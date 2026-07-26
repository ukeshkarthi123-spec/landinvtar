import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft, Heart
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import type { LandProject } from '@/types/database';
import PropertyCard from '@/components/PropertyCard';

export default function FavoritesScreen() {
  const { colors, isDark } = useTheme();
  const { profile, isAuthenticated } = useApp();
  const [favorites, setFavorites] = useState<LandProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const dynamicStyles = getDynamicStyles(colors, isDark);

  const fetchFavorites = useCallback(async () => {
    if (!isAuthenticated || !profile?.id) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          project_id,
          land_projects (*)
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const projects = (data ?? [])
        .map((f: any) => f.land_projects)
        .filter((p: any) => p !== null) as LandProject[];

      setFavorites(projects);
    } catch (err) {
      console.error('[Favorites] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, profile?.id]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFavorites();
  };

  const handleToggleFavorite = (projectId: string, isFav: boolean) => {
    if (!isFav) {
      // If removed, filter it out from the current list
      setFavorites(prev => prev.filter(p => p.id !== projectId));
    }
  };

  return (
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Premium Header */}
      <View style={dynamicStyles.header}>
        <TouchableOpacity style={dynamicStyles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
            <Text style={dynamicStyles.headerTitle}>My Wishlist</Text>
            <Text style={dynamicStyles.headerSub}>{favorites.length} properties saved</Text>
        </View>
      </View>

      {loading ? (
        <View style={dynamicStyles.centered}>
          <ActivityIndicator color={colors.emerald} size="large" />
          <Text style={dynamicStyles.loadingText}>Loading your favorites...</Text>
        </View>
      ) : favorites.length === 0 ? (
        <View style={dynamicStyles.centered}>
          <View style={dynamicStyles.emptyIconBox}>
            <Heart size={48} color={colors.bgCard2} />
          </View>
          <Text style={dynamicStyles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={dynamicStyles.emptySub}>Save premium properties you're interested in to track them here.</Text>
          <TouchableOpacity
            style={dynamicStyles.exploreBtn}
            onPress={() => router.push('/(tabs)/explore')}
          >
            <Text style={dynamicStyles.exploreBtnText}>Explore Properties</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={dynamicStyles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
          }
        >
          <View style={dynamicStyles.projectList}>
            {favorites.map(project => (
                <PropertyCard
                    key={project.id}
                    project={project}
                    onPress={() => router.push(`/property/${project.id}` as any)}
                    isFavoriteInitial={true}
                    onToggleFavorite={handleToggleFavorite}
                />
            ))}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 16,
      paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20,
      borderBottomWidth: 1, borderBottomColor: colors.border
    },
    backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    headerSub: { color: colors.emerald, fontSize: 12, fontWeight: '600', marginTop: 2 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
    loadingText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
    emptyIconBox: { width: 100, height: 100, borderRadius: 40, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.border },
    emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    exploreBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, backgroundColor: colors.emerald },
    exploreBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
    scroll: { padding: 24 },
    projectList: { gap: 8 },
  });
}
