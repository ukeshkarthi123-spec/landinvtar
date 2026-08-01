import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Animated, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  MapPin,
  TrendingUp,
  Users,
  ShieldCheck,
  Star,
  Zap,
  ArrowUpRight,
  Heart
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import type { LandProject } from '@/types/database';

const { width } = Dimensions.get('window');

interface Props {
  project: LandProject;
  onPress: () => void;
  horizontal?: boolean;
  isFavoriteInitial?: boolean;
  onToggleFavorite?: (projectId: string, isFav: boolean) => void;
}

export default function PropertyCard({ project, onPress, horizontal = false, isFavoriteInitial, onToggleFavorite }: Props) {
  const { colors, isDark } = useTheme();
  const { profile, isAuthenticated } = useApp();
  const cardWidth = horizontal ? width * 0.85 : ('100%' as any);

  const [isFav, setIsFav] = useState(isFavoriteInitial ?? false);
  const [favLoading, setFavLoading] = useState(false);

  const scale = React.useRef(new Animated.Value(1)).current;

  const dynamicStyles = getDynamicStyles(colors, isDark);

  // Sync with initial prop if it changes
  useEffect(() => {
    if (isFavoriteInitial !== undefined) {
      setIsFav(isFavoriteInitial);
    }
  }, [isFavoriteInitial]);

  // If initial fav status isn't provided, fetch it
  useEffect(() => {
    let active = true;
    if (isFavoriteInitial === undefined && isAuthenticated && profile?.id) {
      const checkFav = async () => {
        try {
          const { data, error } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', profile.id)
            .eq('project_id', project.id)
            .maybeSingle();

          if (!error && data && active) {
            setIsFav(true);
          }
        } catch (err) {
          console.error('[Fav] Check error:', err);
        }
      };
      checkFav();
    }
    return () => { active = false; };
  }, [isAuthenticated, profile?.id, project.id, isFavoriteInitial]);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  const toggleFavorite = async (e: any) => {
    e.stopPropagation();

    // Diagnosis Logging
    console.log('[Fav] DIAGNOSIS START');
    console.log('[Fav] Auth Status:', isAuthenticated);
    console.log('[Fav] User Profile ID:', profile?.id);
    console.log('[Fav] Project ID:', project.id);
    console.log('[Fav] Current Fav State:', isFav);

    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to save properties to your wishlist.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/login') }
        ]
      );
      return;
    }

    if (!profile?.id) {
      Alert.alert('Profile Error', 'Your user profile could not be loaded. Please try signing in again.');
      return;
    }

    setFavLoading(true);
    const newFavState = !isFav;

    // Optimistic UI update
    setIsFav(newFavState);

    try {
      if (newFavState) {
        console.log('[Fav] Attempting INSERT...');
        const payload = { user_id: profile.id, project_id: project.id };
        console.log('[Fav] Payload:', payload);

        const { data, error } = await supabase
          .from('favorites')
          .insert(payload)
          .select();

        console.log('[Fav] Supabase Response (Insert):', { data, error });
        if (error) throw error;
      } else {
        console.log('[Fav] Attempting DELETE...');
        const { data, error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', profile.id)
          .eq('project_id', project.id)
          .select();

        console.log('[Fav] Supabase Response (Delete):', { data, error });
        if (error) throw error;
      }

      console.log('[Fav] Operation Success. New State:', newFavState);

      if (onToggleFavorite) {
        onToggleFavorite(project.id, newFavState);
      }
    } catch (err: any) {
      console.error('[Fav] END-TO-END ERROR:', err);

      // Revert UI on error
      setIsFav(!newFavState);

      // Real error message for debugging as requested
      Alert.alert(
        'Favorite Error',
        `Details: ${err.message || JSON.stringify(err)}\n\nHint: Ensure the 'favorites' table exists and RLS policies allow authenticated inserts.`
      );
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }], width: cardWidth, marginBottom: 24 }}>
      <TouchableOpacity
        style={dynamicStyles.card}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.95}
      >
        <View style={dynamicStyles.imageContainer}>
          <Image source={{ uri: project.image }} style={dynamicStyles.image} resizeMode="cover" />
          <LinearGradient
            colors={isDark ? ['transparent', 'rgba(11, 15, 20, 0.9)'] : ['transparent', 'rgba(255, 255, 255, 0.9)']}
            style={dynamicStyles.imageOverlay}
          />

          <View style={dynamicStyles.topBadges}>
            <View style={dynamicStyles.approvedBadge}>
              <ShieldCheck size={12} color={colors.emerald} />
              <Text style={dynamicStyles.approvedText}>GOVT APPROVED</Text>
            </View>
            <TouchableOpacity
              style={dynamicStyles.favBtn}
              onPress={toggleFavorite}
              disabled={favLoading}
            >
              {favLoading ? (
                <ActivityIndicator size="small" color={colors.emerald} />
              ) : (
                <Heart
                  size={18}
                  color={isFav ? colors.emerald : (isDark ? "#fff" : colors.textPrimary)}
                  fill={isFav ? colors.emerald : "transparent"}
                />
              )}
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.bottomTags}>
            <View style={dynamicStyles.tag}>
              <ShieldCheck size={12} color={colors.emerald} />
              <Text style={dynamicStyles.tagText}>Verified</Text>
            </View>
            <View style={[dynamicStyles.tag, { backgroundColor: 'rgba(255, 152, 0, 0.2)' }]}>
              <Zap size={12} color="#FF9800" />
              <Text style={[dynamicStyles.tagText, { color: '#FF9800' }]}>{project.risk_score} Risk</Text>
            </View>
          </View>
        </View>

        <View style={dynamicStyles.content}>
          <View style={dynamicStyles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.projectName}>{project.name}</Text>
              <View style={dynamicStyles.locationRow}>
                <MapPin size={14} color={colors.textMuted} />
                <Text style={dynamicStyles.locationText}>{project.location}, {project.city}</Text>
              </View>
            </View>
            <View style={dynamicStyles.ratingBox}>
              <Star size={14} color="#FBBF24" fill="#FBBF24" />
              <Text style={dynamicStyles.ratingText}>{Number(project.rating || 5).toFixed(1)}</Text>
            </View>
          </View>

          <View style={dynamicStyles.fundingSection}>
            <View style={dynamicStyles.fundingHeader}>
              <Text style={dynamicStyles.fundingLabel}>Funding Progress</Text>
              <Text style={dynamicStyles.fundingValue}>{project.funding_progress}%</Text>
            </View>
            <View style={dynamicStyles.progressBg}>
              <View style={[dynamicStyles.progressFill, { width: `${project.funding_progress}%`, backgroundColor: colors.emerald }]} />
            </View>
            <View style={dynamicStyles.investorRow}>
              <Users size={12} color={colors.textMuted} />
              <Text style={dynamicStyles.investorText}>{project.investors_count} Investors joined</Text>
            </View>
          </View>

          <View style={dynamicStyles.statsGrid}>
            <View style={dynamicStyles.statItem}>
              <Text style={dynamicStyles.statLabel}>Target ROI</Text>
              <Text style={dynamicStyles.statValue}>{project.expected_roi}% p.a.</Text>
            </View>
            <View style={dynamicStyles.statDivider} />
            <View style={dynamicStyles.statItem}>
              <Text style={dynamicStyles.statLabel}>Min. Investment</Text>
              <Text style={dynamicStyles.statValue}>₹{project.min_investment.toLocaleString('en-IN')}</Text>
            </View>
            <View style={dynamicStyles.statDivider} />
            <View style={dynamicStyles.statItem}>
              <Text style={dynamicStyles.statLabel}>Duration</Text>
              <Text style={dynamicStyles.statValue}>{project.duration || project.timeline || 'N/A'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={dynamicStyles.investBtn}
            onPress={onPress}
          >
            <LinearGradient
              colors={colors.gradientGreen}
              style={dynamicStyles.investBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={dynamicStyles.investBtnText}>Invest Now</Text>
              <ArrowUpRight size={18} color={isDark ? "#fff" : "#000"} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    imageContainer: { height: 200, position: 'relative' },
    image: { width: '100%', height: '100%' },
    imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
    topBadges: {
      position: 'absolute',
      top: 16,
      left: 16,
      right: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    approvedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.emerald + '26', // 15% opacity
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.emerald + '4d', // 30% opacity
    },
    approvedText: { color: colors.emerald, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    favBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomTags: {
      position: 'absolute',
      bottom: 16,
      left: 16,
      flexDirection: 'row',
      gap: 8,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(11, 15, 20, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    tagText: { color: colors.emerald, fontSize: 11, fontWeight: '700' },
    content: { padding: 20 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    projectName: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 6 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
    ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    ratingText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    fundingSection: { marginBottom: 20 },
    fundingHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    fundingLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    fundingValue: { color: colors.emerald, fontSize: 12, fontWeight: '800' },
    progressBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: '100%', borderRadius: 4 },
    investorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    investorText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg, padding: 16, borderRadius: 20, marginBottom: 24 },
    statItem: { flex: 1, alignItems: 'center' },
    statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
    statValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    statDivider: { width: 1, height: 24, backgroundColor: colors.border },
    investBtn: { height: 52, borderRadius: 16, overflow: 'hidden' },
    investBtnGradient: { width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    investBtnText: { color: isDark ? '#fff' : '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  });
}
